import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { candidates } from "./candidates.js";

/**
 * Driver qualifications track licenses and certifications for candidates.
 * Transport-specific: B/C/CE/D/D1/taxi licenses, code 95, ADR, digitachograaf.
 */
export const driverQualifications = pgTable(
  "driver_qualifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    type: varchar("type", { length: 20 }).notNull(),
    adrType: varchar("adr_type", { length: 20 }),
    cardNumber: varchar("card_number", { length: 50 }),
    issuedAt: date("issued_at"),
    expiresAt: date("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("driver_qualifications")
).enableRLS();
