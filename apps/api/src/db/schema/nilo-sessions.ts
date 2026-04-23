import {
  pgTable, uuid, text, varchar, timestamp, integer, jsonb, index,
} from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { candidateApplications } from './applications.js'

export const niloSessions = pgTable(
  'nilo_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    flowId: uuid('flow_id'),
    applicationId: uuid('application_id').references(() => candidateApplications.id, {
      onDelete: 'set null',
    }),
    contactPhone: varchar('contact_phone', { length: 30 }).notNull(),
    contactName: text('contact_name'),
    context: jsonb('context').notNull().default({}),
    state: varchar('state', { length: 30 }).notNull().default('created'),
    verdict: varchar('verdict', { length: 20 }),
    verdictReason: text('verdict_reason'),
    answers: jsonb('answers').notNull().default({}),
    stuckCounter: jsonb('stuck_counter').notNull().default({}),
    reminderCount: integer('reminder_count').notNull().default(0),
    matchScore: integer('match_score'),
    outboundWebhookUrl: text('outbound_webhook_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    initiatedAt: timestamp('initiated_at'),
    completedAt: timestamp('completed_at'),
    lastInboundAt: timestamp('last_inbound_at'),
    lastOutboundAt: timestamp('last_outbound_at'),
  },
  (t) => [
    index('nilo_sessions_contact_phone_idx').on(t.contactPhone),
    index('nilo_sessions_org_state_idx').on(t.organizationId, t.state),
    ...tenantRlsPolicies('nilo_sessions'),
  ],
).enableRLS()
