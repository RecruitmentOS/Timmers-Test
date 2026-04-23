import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloMessages = pgTable(
  'nilo_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull().references(() => niloSessions.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 10 }).notNull(),
    body: text('body').notNull(),
    twilioSid: text('twilio_sid'),
    isFromBot: boolean('is_from_bot').notNull().default(true),
    toolCalls: jsonb('tool_calls'),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
  },
  () => tenantRlsPolicies('nilo_messages'),
).enableRLS()
