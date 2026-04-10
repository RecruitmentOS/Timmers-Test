import { type PgBoss, type Job } from "pg-boss";
import { sql, and, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenantBilling } from "../db/schema/billing.js";
import { meteringService } from "../services/metering.service.js";

// ============================================================
// Billing cron jobs — registered with pg-boss
// ============================================================

type EmptyData = Record<string, never>;

/**
 * Register billing-related cron jobs with pg-boss.
 */
export async function registerBillingJobs(boss: PgBoss): Promise<void> {
  // Monthly usage reporting — 1st of every month at 02:00 UTC
  // Counts active users + vacancies per tenant, reports to Stripe Meters
  await boss.schedule("billing.monthly-usage", "0 2 1 * *");
  await boss.work<EmptyData>(
    "billing.monthly-usage",
    async (_jobs: Job<EmptyData>[]) => {
      console.log("[Billing] Running monthly usage report...");
      try {
        await meteringService.reportMonthlyUsage();
        console.log("[Billing] Monthly usage report completed");
      } catch (err) {
        console.error("[Billing] Monthly usage report failed:", err);
        throw err; // pg-boss will retry
      }
    }
  );

  // Daily trial reminder — every day at 09:00 UTC
  // Finds tenants with trials ending in 3 or 1 day(s) and logs reminders
  // (email sending deferred to Phase 7 EMAIL-01)
  await boss.schedule("billing.trial-reminder", "0 9 * * *");
  await boss.work<EmptyData>(
    "billing.trial-reminder",
    async (_jobs: Job<EmptyData>[]) => {
      console.log("[Billing] Running trial reminder check...");
      try {
        const now = new Date();

        // Check for trials ending in 3 days
        const threeDaysOut = new Date(now.getTime() + 3 * 86_400_000);
        const threeDayStart = new Date(threeDaysOut);
        threeDayStart.setHours(0, 0, 0, 0);
        const threeDayEnd = new Date(threeDaysOut);
        threeDayEnd.setHours(23, 59, 59, 999);

        const trialsEndingSoon3 = await db
          .select({
            organizationId: tenantBilling.organizationId,
            trialEndsAt: tenantBilling.trialEndsAt,
          })
          .from(tenantBilling)
          .where(
            and(
              sql`${tenantBilling.status} = 'trialing'`,
              gte(tenantBilling.trialEndsAt, threeDayStart),
              lte(tenantBilling.trialEndsAt, threeDayEnd)
            )
          );

        for (const row of trialsEndingSoon3) {
          console.log(
            `[Billing] Trial reminder (3 days): org ${row.organizationId} trial ends ${row.trialEndsAt?.toISOString()}`
          );
          // TODO(EMAIL-01): Send trial reminder email via React Email + Resend
        }

        // Check for trials ending in 1 day
        const oneDayOut = new Date(now.getTime() + 1 * 86_400_000);
        const oneDayStart = new Date(oneDayOut);
        oneDayStart.setHours(0, 0, 0, 0);
        const oneDayEnd = new Date(oneDayOut);
        oneDayEnd.setHours(23, 59, 59, 999);

        const trialsEndingSoon1 = await db
          .select({
            organizationId: tenantBilling.organizationId,
            trialEndsAt: tenantBilling.trialEndsAt,
          })
          .from(tenantBilling)
          .where(
            and(
              sql`${tenantBilling.status} = 'trialing'`,
              gte(tenantBilling.trialEndsAt, oneDayStart),
              lte(tenantBilling.trialEndsAt, oneDayEnd)
            )
          );

        for (const row of trialsEndingSoon1) {
          console.log(
            `[Billing] Trial reminder (1 day): org ${row.organizationId} trial ends ${row.trialEndsAt?.toISOString()}`
          );
          // TODO(EMAIL-01): Send urgent trial reminder email via React Email + Resend
        }

        console.log(
          `[Billing] Trial reminder check done: ${trialsEndingSoon3.length} at 3d, ${trialsEndingSoon1.length} at 1d`
        );
      } catch (err) {
        console.error("[Billing] Trial reminder check failed:", err);
        throw err;
      }
    }
  );
}
