import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloWebhookLogs = pgTable(
  'nilo_webhook_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull().references(() => niloSessions.id, { onDelete: 'cascade' }),
    targetUrl: text('target_url').notNull(),
    payload: jsonb('payload').notNull(),
    responseStatus: integer('response_status'),
    attempt: integer('attempt').notNull().default(1),
    error: text('error'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('nilo_webhook_logs_session_id_idx').on(t.sessionId),
    ...tenantRlsPolicies('nilo_webhook_logs'),
  ],
).enableRLS()
