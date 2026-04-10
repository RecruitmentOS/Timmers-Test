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
import { fileMetadata } from "./files.js";
import { candidates } from "./candidates.js";

/**
 * CV parse logs track LLM-based CV parsing attempts.
 * Stores token usage, cost tracking, parsed data, and content hash for dedup.
 */
export const cvParseLogs = pgTable(
  "cv_parse_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => fileMetadata.id),
    candidateId: uuid("candidate_id").references(() => candidates.id),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    modelId: varchar("model_id", { length: 100 }),
    durationMs: integer("duration_ms"),
    status: varchar("status", { length: 20 }).notNull(),
    errorMessage: text("error_message"),
    parsedData: jsonb("parsed_data"),
    contentHash: varchar("content_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("cv_parse_logs")
).enableRLS();
