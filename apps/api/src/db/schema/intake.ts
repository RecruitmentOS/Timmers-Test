import {
  pgTable, uuid, text, boolean, timestamp, varchar, jsonb, integer, unique,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { candidateApplications } from "./applications.js";

export const intakeSessions = pgTable(
  "intake_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    applicationId: uuid("application_id").notNull().unique()
      .references(() => candidateApplications.id, { onDelete: "cascade" }),
    state: varchar("state", { length: 30 }).notNull(),
    verdict: varchar("verdict", { length: 20 }),
    verdictReason: text("verdict_reason"),
    mustHaveAnswers: jsonb("must_have_answers").default({}).notNull(),
    niceToHaveAnswers: jsonb("nice_to_have_answers").default({}).notNull(),
    stuckCounter: jsonb("stuck_counter").default({}).notNull(),
    claudeThreadId: text("claude_thread_id"),
    lastInboundAt: timestamp("last_inbound_at"),
    lastOutboundAt: timestamp("last_outbound_at"),
    reminderCount: integer("reminder_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  () => tenantRlsPolicies("intake_sessions"),
).enableRLS();

export const intakeMessages = pgTable(
  "intake_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    sessionId: uuid("session_id").notNull()
      .references(() => intakeSessions.id, { onDelete: "cascade" }),
    direction: varchar("direction", { length: 10 }).notNull(),
    body: text("body").notNull(),
    twilioSid: text("twilio_sid"),
    isFromBot: boolean("is_from_bot").notNull().default(true),
    toolCalls: jsonb("tool_calls"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("intake_messages"),
).enableRLS();

export const intakeTemplates = pgTable(
  "intake_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    variant: varchar("variant", { length: 30 }).notNull(),
    locale: varchar("locale", { length: 5 }).notNull().default("nl"),
    name: text("name").notNull(),
    body: text("body").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    wabaStatus: varchar("waba_status", { length: 20 }).default("sandbox").notNull(),
    wabaContentSid: text("waba_content_sid"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    unique().on(t.organizationId, t.variant, t.locale),
    ...tenantRlsPolicies("intake_templates"),
  ],
).enableRLS();
