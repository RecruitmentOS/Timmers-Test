import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  pgEnum,
  check,
  integer,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";
import { candidates } from "./candidates.js";
import { vacancies } from "./vacancies.js";
import { clients } from "./clients.js";
import { pipelineStages } from "./pipeline-stages.js";

/**
 * Task status enum. v1 keeps it simple: open | completed.
 * `in_progress` is deferred (see 02-CONTEXT.md).
 */
export const taskStatusEnum = pgEnum("task_status", ["open", "completed"]);

/**
 * Task priority enum. Matches the shared TS TaskPriority type.
 */
export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

/**
 * Tasks represent follow-ups linked to exactly one parent entity
 * (candidate, vacancy, or client). Polymorphism is implemented
 * via three nullable FKs + a CHECK constraint enforcing "exactly one".
 * NOT a generic entity_type/entity_id column — preserves FK integrity.
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    candidateId: uuid("candidate_id").references(() => candidates.id),
    vacancyId: uuid("vacancy_id").references(() => vacancies.id),
    clientId: uuid("client_id").references(() => clients.id),
    assignedToUserId: text("assigned_to_user_id")
      .notNull()
      .references(() => user.id),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id),
    dueDate: timestamp("due_date"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    status: taskStatusEnum("status").notNull().default("open"),
    completedAt: timestamp("completed_at"),
    completedByUserId: text("completed_by_user_id").references(() => user.id),
    autoCreatedFromStageId: uuid("auto_created_from_stage_id").references(
      () => pipelineStages.id
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    ...tenantRlsPolicies("tasks"),
    check(
      "task_exactly_one_parent",
      sql`((${table.candidateId} IS NOT NULL)::int + (${table.vacancyId} IS NOT NULL)::int + (${table.clientId} IS NOT NULL)::int) = 1`
    ),
  ]
).enableRLS();

/**
 * Task auto-creation rules. Per-org, tenant-scoped.
 * Maps (trigger_stage_id) -> (title template, due offset days, priority).
 * When an application moves into `trigger_stage_id`, a task is auto-created.
 * Admin UI for editing deferred to Phase 5; Phase 2 seeds defaults per mode.
 */
export const taskAutoRules = pgTable(
  "task_auto_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    triggerStageId: uuid("trigger_stage_id")
      .notNull()
      .references(() => pipelineStages.id),
    titleTemplate: varchar("title_template", { length: 255 }).notNull(),
    dueOffsetDays: integer("due_offset_days").notNull().default(3),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("task_auto_rules")
).enableRLS();
