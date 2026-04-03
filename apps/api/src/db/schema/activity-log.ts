import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";

/**
 * Activity log records all significant actions across the system.
 * Used for audit trails and candidate/vacancy activity timelines.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("activity_log")
).enableRLS();
