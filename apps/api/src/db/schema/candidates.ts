import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

/**
 * Candidates represent people (person-level data ONLY).
 *
 * CRITICAL DOMAIN RULE: This table has NO vacancy-specific fields.
 * No stage, no qualification, no vacancyId. Those belong on
 * candidate_applications (one person can apply to many vacancies).
 */
export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),
    city: varchar("city", { length: 255 }),
    source: varchar("source", { length: 100 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    geocodedAt: timestamp("geocoded_at"),
    availabilityType: varchar("availability_type", { length: 30 }),
    availabilityStartDate: timestamp("availability_start_date"),
    contractType: varchar("contract_type", { length: 30 }),
    fleksEmployeeUuid: text("fleks_employee_uuid"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  () => tenantRlsPolicies("candidates")
).enableRLS();
