import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'

export const niloApiKeys = pgTable(
  'nilo_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    keyHash: text('key_hash').notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
  },
  () => tenantRlsPolicies('nilo_api_keys'),
).enableRLS()
