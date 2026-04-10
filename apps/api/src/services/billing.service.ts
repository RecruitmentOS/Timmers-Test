import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenantBilling, PLAN_LIMITS } from "../db/schema/billing.js";
import type { PlanTier, UsageSummary, BillingDashboard } from "@recruitment-os/types";

// ============================================================
// Dormant-safe Stripe integration (BILL-09)
// All Stripe calls no-op gracefully when STRIPE_SECRET_KEY absent.
// ============================================================

let stripeInstance: Stripe | null = null;

/** Check if Stripe is configured */
export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Singleton Stripe client — returns null when dormant */
export function getStripe(): Stripe | null {
  if (!isStripeEnabled()) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeInstance;
}

export const billingService = {
  /**
   * Create a Stripe customer + subscription with 14-day trial on org creation.
   * Dormant-safe: creates local billing row even without Stripe keys.
   */
  async createCustomerAndSubscription(
    orgId: string,
    orgName: string,
    email: string,
    planTier: PlanTier = "starter"
  ): Promise<void> {
    const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);
    const stripe = getStripe();

    if (!stripe) {
      // Dormant mode — create local record only
      console.log(
        `[Billing:dormant] Would create Stripe customer for org ${orgId} (${orgName})`
      );
      await db.insert(tenantBilling).values({
        organizationId: orgId,
        stripeCustomerId: null,
        subscriptionId: null,
        planTier,
        trialEndsAt,
        status: "trialing",
      });
      return;
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name: orgName,
      email,
      metadata: { orgId },
    });

    // Create subscription with 3 metered price items and automatic tax
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        { price: process.env.STRIPE_PRICE_ACTIVE_USERS! },
        { price: process.env.STRIPE_PRICE_ACTIVE_VACANCIES! },
        { price: process.env.STRIPE_PRICE_PLACEMENTS! },
      ],
      trial_period_days: 14,
      automatic_tax: { enabled: true },
      metadata: { orgId },
    });

    await db.insert(tenantBilling).values({
      organizationId: orgId,
      stripeCustomerId: customer.id,
      subscriptionId: subscription.id,
      planTier,
      trialEndsAt,
      status: "trialing",
    });
  },

  /**
   * Create a Stripe billing portal session for self-service management (BILL-01).
   * Returns the portal URL or null when dormant.
   */
  async createPortalSession(
    orgId: string,
    returnUrl: string
  ): Promise<string | null> {
    const stripe = getStripe();
    if (!stripe) {
      console.log(`[Billing:dormant] Would create portal session for org ${orgId}`);
      return null;
    }

    const billing = await this.getTenantBilling(orgId);
    if (!billing?.stripeCustomerId) return null;

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: returnUrl,
    });

    return session.url;
  },

  /**
   * Get the tenant billing record for an organization.
   */
  async getTenantBilling(orgId: string) {
    const rows = await db
      .select()
      .from(tenantBilling)
      .where(eq(tenantBilling.organizationId, orgId));
    return rows[0] ?? null;
  },

  /**
   * Get usage summary with current counters and plan limits.
   */
  async getUsageSummary(orgId: string): Promise<UsageSummary> {
    const billing = await this.getTenantBilling(orgId);
    const tier = (billing?.planTier ?? "starter") as PlanTier;
    const limits = PLAN_LIMITS[tier];

    return {
      activeUsers: billing?.currentActiveUsers ?? 0,
      activeVacancies: billing?.currentActiveVacancies ?? 0,
      placements: billing?.currentPlacements ?? 0,
      limits: {
        maxUsers: limits.maxUsers,
        maxActiveVacancies: limits.maxActiveVacancies,
        maxPlacements: limits.maxPlacements,
      },
      planTier: tier,
    };
  },

  /**
   * Get billing dashboard data including usage, trial, status, and portal availability.
   */
  async getBillingDashboard(orgId: string): Promise<BillingDashboard> {
    const usage = await this.getUsageSummary(orgId);
    const billing = await this.getTenantBilling(orgId);

    return {
      usage,
      trialEndsAt: billing?.trialEndsAt?.toISOString() ?? null,
      status: (billing?.status as BillingDashboard["status"]) ?? "incomplete",
      portalUrl: billing?.stripeCustomerId ? "available" : null,
    };
  },

  /**
   * Handle Stripe webhook events for subscription lifecycle.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;
        if (!orgId) break;

        await db
          .update(tenantBilling)
          .set({
            status: mapSubscriptionStatus(subscription.status),
            updatedAt: new Date(),
          })
          .where(eq(tenantBilling.organizationId, orgId));
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.orgId;
        if (!orgId) break;

        await db
          .update(tenantBilling)
          .set({
            status: "canceled",
            updatedAt: new Date(),
          })
          .where(eq(tenantBilling.organizationId, orgId));
        break;
      }

      case "invoice.payment_succeeded": {
        // No action needed — Stripe handles payment recording
        console.log(
          `[Billing] invoice.payment_succeeded: ${(event.data.object as any).id}`
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        if (!customerId) break;

        await db
          .update(tenantBilling)
          .set({
            status: "past_due",
            updatedAt: new Date(),
          })
          .where(eq(tenantBilling.stripeCustomerId, customerId));
        break;
      }
    }
  },
};

/** Map Stripe subscription status to our BillingStatus */
function mapSubscriptionStatus(
  stripeStatus: string
): "trialing" | "active" | "past_due" | "canceled" | "incomplete" {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "active";
  }
}
