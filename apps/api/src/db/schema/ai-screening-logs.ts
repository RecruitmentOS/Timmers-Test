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

/**
 * AI screening logs track LLM-based candidate screening attempts.
 * Stores verdict, reasoning, confidence, token usage, and content hash for caching.
 */
export const aiScreeningLogs = pgTable(
  "ai_screening_logs",
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
    verdict: varchar("verdict", { length: 10 }), // "yes" | "maybe" | "no"
    reasoning: text("reasoning"),
    confidence: varchar("confidence", { length: 10 }), // e.g. "0.85"
    matchedCriteria: jsonb("matched_criteria"), // string[]
    missingCriteria: jsonb("missing_criteria"), // string[]
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    modelId: varchar("model_id", { length: 100 }),
    durationMs: integer("duration_ms"),
    contentHash: varchar("content_hash", { length: 128 }), // SHA-256 of vacancy criteria + candidate data
    status: varchar("status", { length: 20 }).notNull().default("pending"), // "pending" | "success" | "error"
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("ai_screening_logs")
).enableRLS();
