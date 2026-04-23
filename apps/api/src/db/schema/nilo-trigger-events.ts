import { pgTable, uuid, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloTriggerEvents = pgTable(
  'nilo_trigger_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    externalRef: text('external_ref'),
    payload: jsonb('payload').notNull(),
    sessionId: uuid('session_id').references(() => niloSessions.id),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
  },
  (t) => [
    unique('nilo_trigger_events_dedup').on(t.organizationId, t.externalRef),
    ...tenantRlsPolicies('nilo_trigger_events'),
  ],
).enableRLS()
