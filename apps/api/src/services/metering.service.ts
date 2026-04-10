import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenantBilling } from "../db/schema/billing.js";
import { member, organization } from "../db/schema/auth.js";
import { vacancies } from "../db/schema/index.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { domainEvents } from "../lib/domain-events.js";
import { isStripeEnabled, getStripe } from "./billing.service.js";

// ============================================================
// Metering service — usage counting + Stripe meter event reporting
// Dormant-safe: logs instead of calling Stripe when keys absent.
// ============================================================

export const meteringService = {
  /**
   * Report a meter event to Stripe Billing Meters.
   * NOTE: value MUST be String per Stripe API requirement (research pitfall #2).
   */
  async reportMeterEvent(
    stripeCustomerId: string,
    meterName: string,
    value: number
  ): Promise<void> {
    const stripe = getStripe();
    if (!stripe) {
      console.log(
        `[Metering:dormant] Would report ${meterName}=${value} for customer ${stripeCustomerId}`
      );
      return;
    }

    await stripe.billing.meterEvents.create({
      event_name: meterName,
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: String(value),
      },
    });
  },

  /**
   * Count active members for an organization.
   */
  async countActiveUsers(orgId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(member)
      .where(eq(member.organizationId, orgId));
    return rows[0]?.count ?? 0;
  },

  /**
   * Count active vacancies for an organization (RLS-scoped).
   */
  async countActiveVacancies(orgId: string): Promise<number> {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(vacancies)
        .where(eq(vacancies.status, "active"));
      return rows[0]?.count ?? 0;
    });
  },

  /**
   * Monthly cron: report usage for all tenants with Stripe customers.
   * Counts active users + active vacancies, reports meter events,
   * and updates local counters.
   */
  async reportMonthlyUsage(): Promise<void> {
    const billingRows = await db
      .select()
      .from(tenantBilling)
      .where(sql`${tenantBilling.stripeCustomerId} IS NOT NULL`);

    for (const row of billingRows) {
      try {
        const activeUsers = await this.countActiveUsers(row.organizationId);
        const activeVacancies = await this.countActiveVacancies(
          row.organizationId
        );

        // Report meter events to Stripe
        await this.reportMeterEvent(
          row.stripeCustomerId!,
          "active_users",
          activeUsers
        );
        await this.reportMeterEvent(
          row.stripeCustomerId!,
          "active_vacancies",
          activeVacancies
        );

        // Update local counters
        await db
          .update(tenantBilling)
          .set({
            currentActiveUsers: activeUsers,
            currentActiveVacancies: activeVacancies,
            updatedAt: new Date(),
          })
          .where(eq(tenantBilling.id, row.id));

        console.log(
          `[Metering] Reported usage for org ${row.organizationId}: users=${activeUsers}, vacancies=${activeVacancies}`
        );
      } catch (err) {
        console.error(
          `[Metering] Failed to report usage for org ${row.organizationId}:`,
          err
        );
      }
    }
  },

  /**
   * Report a single placement event (agency-mode only, BILL-04).
   * Increments the local counter and reports to Stripe.
   */
  async reportPlacement(orgId: string): Promise<void> {
    const billing = await db
      .select()
      .from(tenantBilling)
      .where(eq(tenantBilling.organizationId, orgId));

    const row = billing[0];
    if (!row) {
      console.warn(`[Metering] No billing record for org ${orgId} — skipping placement`);
      return;
    }

    // Check if org is in agency mode (placement metering is agency-only)
    const [org] = await db
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, orgId));

    if (org?.metadata) {
      try {
        const meta = typeof org.metadata === "string" ? JSON.parse(org.metadata) : org.metadata;
        if (meta.mode !== "agency") {
          console.log(
            `[Metering] Org ${orgId} is not agency mode — skipping placement metering`
          );
          return;
        }
      } catch {
        // If metadata parse fails, proceed with metering
      }
    }

    // Report meter event if Stripe customer exists
    if (row.stripeCustomerId) {
      await this.reportMeterEvent(row.stripeCustomerId, "placements", 1);
    }

    // Increment local counter
    await db
      .update(tenantBilling)
      .set({
        currentPlacements: sql`${tenantBilling.currentPlacements} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tenantBilling.id, row.id));

    console.log(`[Metering] Reported placement for org ${orgId}`);
  },
};

// ============================================================
// Wire placement metering to domain events (BILL-04)
// Non-blocking: catch and log errors, never fail the stage change.
// ============================================================

domainEvents.subscribe(async (event) => {
  if (event.type !== "application.stage_changed") return;

  // Check if the target stage is "hired" by looking up the stage name
  try {
    const { pipelineStages } = await import("../db/schema/index.js");
    const rows = await db
      .select({ name: pipelineStages.name })
      .from(pipelineStages)
      .where(eq(pipelineStages.id, event.toStageId));

    const stageName = rows[0]?.name?.toLowerCase();
    if (stageName === "hired" || stageName === "aangenomen") {
      await meteringService.reportPlacement(event.orgId);
    }
  } catch (err) {
    console.error(
      `[Metering] Failed to process placement event for org ${event.orgId}:`,
      err
    );
  }
});
