import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";

/**
 * Notifications table — per-user inbox for mentions, assignments, and HM feedback events.
 * Tenant-scoped via organization_id (tenantRlsPolicies) AND user-scoped via a separate
 * per-user policy applied in setup-rls.sql (user_id = app.user_id).
 * readAt = null means unread.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Recipient user ID */
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    organizationId: uuid("organization_id").notNull(),
    /** 'mention' | 'assignment' | 'hm_feedback' | 'hm_request' */
    kind: varchar("kind", { length: 30 }).notNull(),
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetId: uuid("target_id").notNull(),
    /** Who triggered the notification */
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    /** Additional context (e.g. comment body preview, stage name) */
    meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
    /** null = unread; timestamp = when the user marked it read */
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("notifications")
).enableRLS();

/**
 * Notification preferences — per-user email opt-out toggles (GDPR-03).
 * NOT tenant-scoped (keyed on userId, like user preferences).
 * All defaults are true — users must explicitly opt out.
 */
export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id)
    .unique(),
  emailMentions: boolean("email_mentions").notNull().default(true),
  emailAssignments: boolean("email_assignments").notNull().default(true),
  emailTaskReminders: boolean("email_task_reminders").notNull().default(true),
  emailDocumentExpiry: boolean("email_document_expiry").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
