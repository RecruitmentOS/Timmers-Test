import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { timingSafeEqual, createHash } from 'node:crypto'
import type { AppEnv } from '../lib/app-env.js'
import { db } from '../db/index.js'
import { niloApiKeys, niloSessions, niloTriggerEvents } from '../db/schema/index.js'
import { withTenantContext } from '../lib/with-tenant-context.js'
import { getJobQueue } from '../lib/job-queue.js'

const triggerSchema = z.object({
  external_ref: z.string().max(255).optional(),
  contact: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format'),
    name: z.string().max(255).optional(),
  }),
  context: z.record(z.string(), z.unknown()).optional(),
})

async function resolveApiKey(rawKey: string): Promise<{ orgId: string } | null> {
  const incoming = createHash('sha256').update(rawKey).digest('hex')
  const rows = await db
    .select({ orgId: niloApiKeys.organizationId, storedHash: niloApiKeys.keyHash })
    .from(niloApiKeys)
    .where(isNull(niloApiKeys.revokedAt))

  for (const row of rows) {
    const stored = Buffer.from(row.storedHash, 'utf8')
    const candidate = Buffer.from(incoming, 'utf8')
    if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) {
      return { orgId: row.orgId }
    }
  }
  return null
}

export const niloTriggerRoutes = new Hono<AppEnv>().post('/', async (c) => {
  // 1. Extract and validate API key
  const authHeader = c.req.header('Authorization') ?? ''
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!rawKey) return c.json({ error: 'missing api key' }, 401)

  const keyRecord = await resolveApiKey(rawKey)
  if (!keyRecord) return c.json({ error: 'invalid api key' }, 401)

  const { orgId } = keyRecord

  // 2. Validate body
  const body = await c.req.json().catch(() => null)
  const parsed = triggerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400)
  }

  const { external_ref, contact, context = {} } = parsed.data

  // 3. Idempotency check via external_ref (read-only query, no tenant context needed)
  if (external_ref) {
    const [existing] = await db
      .select({ sessionId: niloTriggerEvents.sessionId })
      .from(niloTriggerEvents)
      .where(
        and(
          eq(niloTriggerEvents.organizationId, orgId),
          eq(niloTriggerEvents.externalRef, external_ref),
        ),
      )
      .limit(1)

    if (existing?.sessionId) {
      return c.json({ session_id: existing.sessionId, duplicate: true }, 409)
    }
  }

  // 4. Create session + log trigger event (both need withTenantContext for RLS)
  let sessionId!: string

  await withTenantContext(orgId, async (tx) => {
    const [session] = await tx
      .insert(niloSessions)
      .values({
        organizationId: orgId,
        contactPhone: contact.phone,
        contactName: contact.name ?? null,
        context,
        state: 'created',
      })
      .returning({ id: niloSessions.id })

    if (!session) throw new Error('session creation failed')
    sessionId = session.id

    await tx.insert(niloTriggerEvents).values({
      organizationId: orgId,
      externalRef: external_ref ?? null,
      payload: { contact, context, external_ref },
      sessionId: session.id,
    })
  })

  // 5. Enqueue start job (gracefully skip if job queue not enabled)
  try {
    const boss = getJobQueue()
    await boss.send('nilo.start', { orgId, sessionId })
  } catch {
    // Job queue not started (JOBS_ENABLED=false in dev) — session still created
  }

  return c.json({ session_id: sessionId, state: 'created' }, 201)
})
