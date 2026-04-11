import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  date,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { organization, user } from "./auth.js";
import { vacancies } from "./vacancies.js";

// ============================================================
// Campaigns - tracks ad campaigns per vacancy per channel
// RLS on organization_id
// ============================================================

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    name: varchar("name", { length: 255 }).notNull(),
    channel: varchar("channel", { length: 100 }).notNull(), // meta | indeed | google | linkedin | manual
    status: varchar("status", { length: 50 }).notNull().default("draft"), // draft | active | paused | completed
    budgetCents: integer("budget_cents"),
    currency: varchar("currency", { length: 3 }).default("EUR"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    metaCampaignId: varchar("meta_campaign_id", { length: 100 }),
    metaAdsetId: varchar("meta_adset_id", { length: 100 }),
    spendCents: integer("spend_cents").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("campaigns")
).enableRLS();

// ============================================================
// Targeting Templates - reusable Meta targeting configurations
// RLS on organization_id
// ============================================================

export const targetingTemplates = pgTable(
  "targeting_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    targetingSpec: jsonb("targeting_spec").notNull(), // mirrors Meta Targeting object
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("targeting_templates")
).enableRLS();

// ============================================================
// Persona Templates - ideal candidate criteria + targeting link
// RLS on organization_id
// ============================================================

export const personaTemplates = pgTable(
  "persona_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    vacancyId: uuid("vacancy_id").references(() => vacancies.id),
    name: varchar("name", { length: 255 }).notNull(),
    candidateCriteria: jsonb("candidate_criteria").notNull(), // ideal candidate attributes
    targetingTemplateId: uuid("targeting_template_id").references(
      () => targetingTemplates.id
    ),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("persona_templates")
).enableRLS();

// ============================================================
// Campaign Daily Metrics - granular per-day stats from Meta API
// RLS on organization_id
// ============================================================

export const campaignDailyMetrics = pgTable(
  "campaign_daily_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    date: date("date").notNull(),
    spendCents: integer("spend_cents").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    actions: jsonb("actions"), // raw Meta actions data
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    ...tenantRlsPolicies("campaign_daily_metrics"),
    unique("campaign_daily_metrics_campaign_date_uq").on(
      t.campaignId,
      t.date
    ),
  ]
).enableRLS();

// ============================================================
// Meta Connections - org-level Meta ad account credentials
// NO RLS (admin-only, like tenant_billing)
// ============================================================

export const metaConnections = pgTable("meta_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id),
  metaAdAccountId: varchar("meta_ad_account_id", { length: 100 }).notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
