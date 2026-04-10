import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { user } from "./auth.js";

/**
 * File metadata tracks uploaded documents (CVs, attachments, etc.)
 * stored in S3-compatible object storage (Cloudflare R2).
 *
 * Actual files are stored externally; this table only holds metadata.
 */
export const fileMetadata = pgTable(
  "file_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes"),
    s3Key: varchar("s3_key", { length: 500 }).notNull(),
    documentType: varchar("document_type", { length: 20 }),
    expiresAt: date("expires_at"),
    contentHash: varchar("content_hash", { length: 64 }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("file_metadata")
).enableRLS();
