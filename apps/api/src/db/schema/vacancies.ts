import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";
import { clients } from "./clients.js";

/**
 * Vacancy status enum.
 */
export const vacancyStatusEnum = pgEnum("vacancy_status", [
  "draft",
  "active",
  "paused",
  "closed",
  "archived",
]);

/**
 * Vacancies represent open positions that the agency is recruiting for.
 * Each vacancy belongs to one organization and has an owner (recruiter).
 */
export const vacancies = pgTable(
  "vacancies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 255 }),
    employmentType: varchar("employment_type", { length: 50 }),
    status: vacancyStatusEnum("status").notNull().default("draft"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    clientId: uuid("client_id").references(() => clients.id),
    qualificationCriteria: jsonb("qualification_criteria"),
    slug: varchar("slug", { length: 255 }),
    latitude: numeric("latitude", { precision: 10, scale: 7 }),
    longitude: numeric("longitude", { precision: 10, scale: 7 }),
    geocodedAt: timestamp("geocoded_at"),
    requiredLicenses: jsonb("required_licenses"),
    distributionChannels: jsonb("distribution_channels"),
    hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  () => tenantRlsPolicies("vacancies")
).enableRLS();

/**
 * Vacancy assignments link users (recruiters/agents) to vacancies.
 * A vacancy can have multiple assigned users.
 */
export const vacancyAssignments = pgTable(
  "vacancy_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: varchar("role", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("vacancy_assignments")
).enableRLS();

/**
 * Vacancy notes store internal comments on a vacancy.
 */
export const vacancyNotes = pgTable(
  "vacancy_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("vacancy_notes")
).enableRLS();

/**
 * Client vacancy access controls which vacancies a client can see
 * in their portal view.
 */
export const clientVacancyAccess = pgTable(
  "client_vacancy_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    vacancyId: uuid("vacancy_id")
      .notNull()
      .references(() => vacancies.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("client_vacancy_access")
).enableRLS();
