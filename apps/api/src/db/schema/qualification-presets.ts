import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

/**
 * Qualification presets define reusable screening checklists
 * that can be applied to vacancies. Each preset contains a
 * JSON string of criteria items (e.g. license types, experience).
 *
 * Tenant-scoped with RLS.
 */
export const qualificationPresets = pgTable(
  "qualification_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    criteria: text("criteria").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("qualification_presets")
).enableRLS();
