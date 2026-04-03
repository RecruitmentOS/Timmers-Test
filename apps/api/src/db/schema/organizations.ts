import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";
import { clients } from "./clients.js";

/**
 * Client user assignments map portal users (client_viewer role)
 * to specific client records. This controls which client's data
 * they can see in the client portal.
 */
export const clientUserAssignments = pgTable(
  "client_user_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () =>
    tenantRlsPolicies("client_user_assignments")
).enableRLS();
