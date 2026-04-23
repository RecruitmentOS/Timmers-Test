import 'dotenv/config'
import { createHash, randomBytes } from 'node:crypto'
import { dbAdmin } from '../src/db/index.js'
import { niloApiKeys } from '../src/db/schema/index.js'

const orgId = process.env['TIMMERS_ORG_ID']
if (!orgId) throw new Error('TIMMERS_ORG_ID env var required')

const rawKey = `nilo_${randomBytes(32).toString('hex')}`
const keyHash = createHash('sha256').update(rawKey).digest('hex')

await dbAdmin.insert(niloApiKeys).values({
  organizationId: orgId,
  keyHash,
  label: 'Timmers default',
})

console.log('✅ API key created')
console.log('Raw key (save this — not stored):', rawKey)
console.log('Hash stored in DB:', keyHash)

process.exit(0)
