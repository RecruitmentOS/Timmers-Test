import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

/**
 * Clients represent the companies/employers that the recruitment agency
 * fills positions for. Each client belongs to one organization (tenant).
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    contactPerson: varchar("contact_person", { length: 255 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  () => tenantRlsPolicies("clients")
).enableRLS();
