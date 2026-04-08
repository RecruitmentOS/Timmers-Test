import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { candidateApplications } from "./applications.js";
import { user } from "./auth.js";

/**
 * Application tags: free-text labels applied to candidate_applications
 * via the bulk-tag action (BULK-05). Created on-the-fly during bulk action.
 * Unique per (applicationId, label) so the same label can't be applied twice.
 */
export const applicationTags = pgTable(
  "application_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => candidateApplications.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    ...tenantRlsPolicies("application_tags"),
    unique("application_tags_app_label_unique").on(
      table.applicationId,
      table.label
    ),
  ]
).enableRLS();
