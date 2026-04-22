import {
  pgTable, uuid, text, timestamp, varchar, jsonb, primaryKey,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

export const fleksSyncCursors = pgTable(
  "fleks_sync_cursors",
  {
    organizationId: uuid("organization_id").notNull(),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    lastUpdatedAt: timestamp("last_updated_at"),
    lastSeenIds: jsonb("last_seen_ids").default([]).notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    lastErrorAt: timestamp("last_error_at"),
    lastError: text("last_error"),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.entityType] }),
    ...tenantRlsPolicies("fleks_sync_cursors"),
  ],
).enableRLS();
