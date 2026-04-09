import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";

/**
 * Comments table — polymorphic comment thread for applications, vacancies, and candidates.
 * Supports both recruiter comments and hiring manager feedback (kind = 'hm_feedback').
 * isInternal controls visibility: internal = recruiter-only, not internal = shared with client/HM.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    /** Polymorphic target: 'application' | 'vacancy' | 'candidate' */
    targetType: varchar("target_type", { length: 20 }).notNull(),
    targetId: uuid("target_id").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    /** Array of user ID strings who are mentioned in this comment */
    mentions: jsonb("mentions").$type<string[]>().default([]),
    /** 'comment' for regular comments; 'hm_feedback' for hiring manager feedback (HM-03) */
    kind: varchar("kind", { length: 20 }).notNull().default("comment"),
    /** Thumbs up/down for HM feedback; null for regular comments */
    feedbackThumb: varchar("feedback_thumb", { length: 10 }),
    /** true = internal recruiter comment; false = visible to client/HM portal */
    isInternal: boolean("is_internal").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  () => tenantRlsPolicies("comments")
).enableRLS();
