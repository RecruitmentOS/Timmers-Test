import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  varchar,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

/**
 * External integrations table — stores provider credentials and config per organization.
 * Supports Fleks v2 API and Twilio (WhatsApp) integrations.
 * API keys are encrypted at the application layer before storage.
 */
export const externalIntegrations = pgTable(
  "external_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    provider: varchar("provider", { length: 40 }).notNull(), // 'fleks_v2' | 'twilio'
    apiKeyEncrypted: text("api_key_encrypted"),
    apiBaseUrl: text("api_base_url"),
    additionalConfig: jsonb("additional_config").default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (t) => [
    unique().on(t.organizationId, t.provider),
    ...tenantRlsPolicies("external_integrations"),
  ]
).enableRLS();
