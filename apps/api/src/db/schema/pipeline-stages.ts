import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

/**
 * Pipeline stages define the kanban columns for vacancy pipelines.
 * Each organization has its own set of stages.
 *
 * Default stages (for seed):
 * New, To screen, Contact attempted, Contacted, Qualified,
 * Sent to client, Interview, Hired, Started, Rejected/On hold
 */
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("pipeline_stages")
).enableRLS();
