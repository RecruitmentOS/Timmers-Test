import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";
import { candidates } from "./candidates.js";
import { vacancies } from "./vacancies.js";
import { clients } from "./clients.js";
import { pipelineStages } from "./pipeline-stages.js";
import { campaigns } from "./campaigns.js";

/**
 * Qualification status enum for candidate applications.
 */
export const qualificationStatusEnum = pgEnum("qualification_status", [
  "pending",
  "yes",
  "maybe",
  "no",
]);

/**
 * Candidate applications represent one candidate's journey in one vacancy.
 * This is SEPARATE from the candidate table (person-level data).
 *
 * One candidate can have many applications (one per vacancy).
 * Each application tracks its own stage, qualification, owner, etc.
 */
export const candidateApplications = pgTable(
  "candidate_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    currentStageId: uuid("current_stage_id").references(
      () => pipelineStages.id
    ),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    qualificationStatus: qualificationStatusEnum("qualification_status")
      .notNull()
      .default("pending"),
    sourceDetail: varchar("source_detail", { length: 255 }),
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    assignedAgentId: text("assigned_agent_id").references(() => user.id),
    sentToClient: boolean("sent_to_client").notNull().default(false),
    sentToHiringManager: boolean("sent_to_hiring_manager")
      .notNull()
      .default(false),
    rejectReason: text("reject_reason"),
    qualificationNotes: text("qualification_notes"),
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () =>
    tenantRlsPolicies("candidate_applications")
).enableRLS();

/**
 * Application stage history tracks every stage change for audit trail.
 * Created automatically when an application's stage changes.
 */
export const applicationStageHistory = pgTable(
  "application_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => candidateApplications.id),
    fromStageId: uuid("from_stage_id").references(() => pipelineStages.id),
    toStageId: uuid("to_stage_id")
      .notNull()
      .references(() => pipelineStages.id),
    movedBy: text("moved_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () =>
    tenantRlsPolicies("application_stage_history")
).enableRLS();

/**
 * Placements record the agreed terms when a candidate is hired via an application.
 * One application can have zero or one placement. Tightly coupled to application lifecycle.
 */
export const placements = pgTable(
  "placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => candidateApplications.id),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    clientId: uuid("client_id").references(() => clients.id),
    agreedRate: numeric("agreed_rate", { precision: 8, scale: 2 }),
    inlenersbeloning: boolean("inlenersbeloning").notNull().default(false),
    startDate: timestamp("start_date"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("placements")
).enableRLS();
