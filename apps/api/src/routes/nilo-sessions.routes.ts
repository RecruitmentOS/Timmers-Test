import { Hono } from 'hono'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../lib/app-env.js'
import { niloSessions, niloMessages, niloHandoffs } from '../db/schema/index.js'
import { withTenantContext } from '../lib/with-tenant-context.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { tenantMiddleware } from '../middleware/tenant.middleware.js'

const handoffResolveSchema = z.object({
  resolution: z.enum(['took_over', 'dismissed', 'resumed_bot']),
  verdict: z.enum(['qualified', 'rejected', 'unsure']).optional(),
  verdict_reason: z.string().max(1000).optional(),
})

export const niloSessionsRoutes = new Hono<AppEnv>()
  .use('*', authMiddleware, tenantMiddleware)

  .get('/', async (c) => {
    const orgId = c.get('organizationId')
    const state = c.req.query('state')
    const sessions = await withTenantContext(orgId, async (tx) => {
      const base = tx
        .select({
          id: niloSessions.id,
          contactPhone: niloSessions.contactPhone,
          contactName: niloSessions.contactName,
          state: niloSessions.state,
          verdict: niloSessions.verdict,
          matchScore: niloSessions.matchScore,
          answers: niloSessions.answers,
          context: niloSessions.context,
          createdAt: niloSessions.createdAt,
          completedAt: niloSessions.completedAt,
        })
        .from(niloSessions)
      return state
        ? base.where(eq(niloSessions.state, state)).orderBy(desc(niloSessions.createdAt)).limit(100)
        : base.orderBy(desc(niloSessions.createdAt)).limit(100)
    })
    return c.json({ sessions, total: sessions.length })
  })

  .get('/:id', async (c) => {
    const orgId = c.get('organizationId')
    const sessionId = c.req.param('id')

    const [session, messages, handoffs] = await Promise.all([
      withTenantContext(orgId, (tx) =>
        tx.select().from(niloSessions).where(eq(niloSessions.id, sessionId)).limit(1),
      ),
      withTenantContext(orgId, (tx) =>
        tx
          .select({
            id: niloMessages.id,
            direction: niloMessages.direction,
            body: niloMessages.body,
            isFromBot: niloMessages.isFromBot,
            sentAt: niloMessages.sentAt,
          })
          .from(niloMessages)
          .where(eq(niloMessages.sessionId, sessionId))
          .orderBy(niloMessages.sentAt),
      ),
      withTenantContext(orgId, (tx) =>
        tx
          .select({
            id: niloHandoffs.id,
            reason: niloHandoffs.reason,
            requestedAt: niloHandoffs.requestedAt,
            resolvedAt: niloHandoffs.resolvedAt,
            resolution: niloHandoffs.resolution,
          })
          .from(niloHandoffs)
          .where(eq(niloHandoffs.sessionId, sessionId)),
      ),
    ])

    if (!session[0]) return c.json({ error: 'not found' }, 404)
    return c.json({ ...session[0], messages, handoffs })
  })

  .patch('/:id/handoff', async (c) => {
    const orgId = c.get('organizationId')
    const sessionId = c.req.param('id')
    const user = c.get('user')

    const body = await c.req.json().catch(() => null)
    const parsed = handoffResolveSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'invalid request' }, 400)

    const { resolution, verdict, verdict_reason } = parsed.data

    await withTenantContext(orgId, async (tx) => {
      const [handoff] = await tx
        .select({ id: niloHandoffs.id })
        .from(niloHandoffs)
        .where(eq(niloHandoffs.sessionId, sessionId))
        .orderBy(desc(niloHandoffs.requestedAt))
        .limit(1)

      if (handoff) {
        await tx
          .update(niloHandoffs)
          .set({
            resolvedAt: new Date(),
            resolution,
            assignedTo: user?.id ? (user.id as unknown as string) : null,
            acceptedAt: new Date(),
          })
          .where(eq(niloHandoffs.id, handoff.id))
      }

      if (resolution === 'resumed_bot') {
        await tx
          .update(niloSessions)
          .set({ state: 'in_progress' })
          .where(eq(niloSessions.id, sessionId))
      } else if (resolution === 'dismissed' && verdict) {
        await tx
          .update(niloSessions)
          .set({
            state: 'completed',
            verdict,
            verdictReason: verdict_reason ?? 'manual verdict by recruiter',
            completedAt: new Date(),
          })
          .where(eq(niloSessions.id, sessionId))
      }
    })

    return c.json({ ok: true })
  })
