import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloHandoffs = pgTable(
  'nilo_handoffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull().references(() => niloSessions.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 40 }).notNull(),
    context: text('context'),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    assignedTo: uuid('assigned_to'),
    acceptedAt: timestamp('accepted_at'),
    resolvedAt: timestamp('resolved_at'),
    resolution: varchar('resolution', { length: 30 }),
  },
  () => tenantRlsPolicies('nilo_handoffs'),
).enableRLS()
