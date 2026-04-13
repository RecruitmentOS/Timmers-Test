import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";

/**
 * Calendar connections store encrypted OAuth tokens for Google and Outlook
 * calendar integrations. Tokens are encrypted at the application layer.
 */
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    provider: varchar("provider", { length: 20 }).notNull(), // "google" | "outlook"
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at"),
    calendarEmail: varchar("calendar_email", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("calendar_connections")
).enableRLS();
