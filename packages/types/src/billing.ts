/** Plan tier determines quota limits and Stripe price ID */
export type PlanTier = "starter" | "growth" | "enterprise";

/** Billing subscription status — mirrors Stripe subscription lifecycle */
export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

/** Tenant billing record linking organization to Stripe */
export interface TenantBilling {
  id: string;
  organizationId: string;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  planTier: PlanTier;
  trialEndsAt: string | null;
  status: BillingStatus;
  currentActiveUsers: number;
  currentActiveVacancies: number;
  currentPlacements: number;
  createdAt: string;
  updatedAt: string;
}

/** Quota limits for a given plan tier */
export interface PlanLimits {
  maxUsers: number;
  maxActiveVacancies: number;
  maxPlacements: number;
}

/** Current usage vs limits for dashboard display */
export interface UsageSummary {
  activeUsers: number;
  activeVacancies: number;
  placements: number;
  limits: PlanLimits;
  planTier: PlanTier;
}

/** Full billing dashboard response */
export interface BillingDashboard {
  usage: UsageSummary;
  trialEndsAt: string | null;
  status: BillingStatus;
  portalUrl: string | null;
}
