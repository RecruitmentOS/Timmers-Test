import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization } from "./auth.js";

// ============================================================
// Billing table - global (NOT tenant-scoped, no RLS)
// Links an organization to its Stripe customer/subscription
// and tracks current usage counters for plan limit enforcement.
// ============================================================

export const tenantBilling = pgTable("tenant_billing", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id),
  stripeCustomerId: text("stripe_customer_id").unique(),
  subscriptionId: text("subscription_id"),
  planTier: varchar("plan_tier", { length: 20 }).notNull().default("starter"),
  trialEndsAt: timestamp("trial_ends_at"),
  status: varchar("status", { length: 20 }).notNull().default("trialing"),
  currentActiveUsers: integer("current_active_users").notNull().default(0),
  currentActiveVacancies: integer("current_active_vacancies")
    .notNull()
    .default(0),
  currentPlacements: integer("current_placements").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// Plan limits per tier (BILL-05)
// Used by enforcement middleware to check quota before mutations.
// ============================================================

export const PLAN_LIMITS = {
  starter: {
    maxUsers: 3,
    maxActiveVacancies: 5,
    maxPlacements: Infinity,
  },
  growth: {
    maxUsers: 10,
    maxActiveVacancies: 25,
    maxPlacements: Infinity,
  },
  enterprise: {
    maxUsers: Infinity,
    maxActiveVacancies: Infinity,
    maxPlacements: Infinity,
  },
} as const;
