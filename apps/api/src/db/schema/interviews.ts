import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { candidateApplications } from "./applications.js";
import { vacancies } from "./vacancies.js";
import { candidates } from "./candidates.js";
import { user } from "./auth.js";
import { calendarConnections } from "./calendar-connections.js";

/**
 * Interviews link applications to calendar events.
 * Tracks scheduled time, duration, location, and external calendar event ID.
 */
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => candidateApplications.id),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    scheduledBy: text("scheduled_by")
      .notNull()
      .references(() => user.id),
    calendarConnectionId: uuid("calendar_connection_id").references(
      () => calendarConnections.id
    ),
    calendarEventId: varchar("calendar_event_id", { length: 255 }),
    scheduledAt: timestamp("scheduled_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    location: text("location"),
    notes: text("notes"),
    status: varchar("status", { length: 20 }).notNull().default("scheduled"), // "scheduled" | "completed" | "cancelled"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("interviews")
).enableRLS();

/**
 * Interview scorecards — structured evaluation form submitted after an interview.
 * One scorecard per interview (unique constraint on interviewId).
 */
export const interviewScorecards = pgTable(
  "interview_scorecards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    interviewId: uuid("interview_id")
      .notNull()
      .unique()
      .references(() => interviews.id, { onDelete: "cascade" }),
    interviewerId: text("interviewer_id")
      .notNull()
      .references(() => user.id),
    criteria: jsonb("criteria")
      .$type<Array<{ label: string; rating: number; notes: string }>>()
      .notNull()
      .default([]),
    overallRating: integer("overall_rating").notNull(),
    recommendation: varchar("recommendation", { length: 20 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  () => tenantRlsPolicies("interview_scorecards")
).enableRLS();
