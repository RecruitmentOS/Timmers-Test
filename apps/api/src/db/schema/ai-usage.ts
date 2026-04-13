import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { organization } from "./auth.js";

// ============================================================
// AI Usage table - global (NOT tenant-scoped, no RLS)
// Tracks monthly AI usage counters and quota limits per tenant.
// One row per organization per month.
// ============================================================

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    monthKey: varchar("month_key", { length: 7 }).notNull(), // "2026-04" format
    screeningCount: integer("screening_count").notNull().default(0),
    screeningTokens: integer("screening_tokens").notNull().default(0),
    parseCount: integer("parse_count").notNull().default(0),
    parseTokens: integer("parse_tokens").notNull().default(0),
    quotaLimit: integer("quota_limit").notNull().default(500),
    quotaNotifiedAt: timestamp("quota_notified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("ai_usage_org_month_unique").on(table.organizationId, table.monthKey),
  ]
);
