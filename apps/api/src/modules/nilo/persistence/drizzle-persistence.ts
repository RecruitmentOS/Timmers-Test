import { eq, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { niloSessions, niloMessages } from '../../../db/schema/index.js'
import { withTenantContext } from '../../../lib/with-tenant-context.js'
import type { NiloPersistence, NiloSession, NiloConfidence } from '@hey-nilo/core'
import type { PgBoss } from 'pg-boss'

function rowToSession(row: typeof niloSessions.$inferSelect): NiloSession {
  return {
    id: row.id,
    orgId: row.organizationId,
    flowId: row.flowId,
    contactPhone: row.contactPhone,
    contactName: row.contactName,
    context: (row.context ?? {}) as Record<string, unknown>,
    state: row.state as NiloSession['state'],
    verdict: row.verdict as NiloSession['verdict'],
    verdictReason: row.verdictReason,
    answers: (row.answers ?? {}) as Record<string, { value: unknown; confidence: NiloConfidence }>,
    stuckCounter: (row.stuckCounter ?? {}) as Record<string, number>,
    reminderCount: row.reminderCount,
    matchScore: row.matchScore,
    outboundWebhookUrl: row.outboundWebhookUrl,
    createdAt: row.createdAt,
    initiatedAt: row.initiatedAt,
    completedAt: row.completedAt,
    lastInboundAt: row.lastInboundAt,
    lastOutboundAt: row.lastOutboundAt,
  }
}

export function createDrizzlePersistence(boss: PgBoss): NiloPersistence {
  return {
    async getSession(orgId, sessionId) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select()
          .from(niloSessions)
          .where(eq(niloSessions.id, sessionId))
          .limit(1)
        return row ? rowToSession(row) : null
      })
    },

    async getRecentMessages(orgId, sessionId, limit = 20) {
      return withTenantContext(orgId, async (tx) => {
        const rows = await tx
          .select({
            direction: niloMessages.direction,
            body: niloMessages.body,
            sentAt: niloMessages.sentAt,
          })
          .from(niloMessages)
          .where(eq(niloMessages.sessionId, sessionId))
          .orderBy(niloMessages.sentAt)
          .limit(limit)
        return rows as Array<{ direction: 'inbound' | 'outbound'; body: string; sentAt: Date }>
      })
    },

    async setInitiated(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({ state: 'initiated', initiatedAt: new Date() })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async setInProgress(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({ state: 'in_progress' })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async incrementReminderCount(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx.execute(
          sql`UPDATE nilo_sessions SET reminder_count = reminder_count + 1 WHERE id = ${sessionId}`,
        )
      })
    },

    async persistOutbound(orgId, sessionId, body, twilioSid, toolCalls) {
      await withTenantContext(orgId, async (tx) => {
        await tx.insert(niloMessages).values({
          organizationId: orgId,
          sessionId,
          direction: 'outbound',
          body,
          twilioSid: twilioSid || null,
          isFromBot: true,
          toolCalls: toolCalls ? (toolCalls as unknown as Record<string, unknown>[]) : null,
        })
        await tx
          .update(niloSessions)
          .set({ lastOutboundAt: new Date() })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async recordAnswer(orgId, sessionId, key, value, confidence) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({
            answers: sql`answers || ${JSON.stringify({ [key]: { value, confidence } })}::jsonb`,
          })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async bumpStuck(orgId, sessionId, key) {
      const rows = await db.execute<{ count: number }>(
        sql`UPDATE nilo_sessions
            SET stuck_counter = jsonb_set(
              stuck_counter,
              ${`{${key}}`}::text[],
              (COALESCE((stuck_counter->>${key})::int, 0) + 1)::text::jsonb
            )
            WHERE id = ${sessionId}
            RETURNING (stuck_counter->>${key})::int as count`,
      )
      const row = (rows as unknown as Array<{ count: number }>)[0]
      return row?.count ?? 0
    },

    async escalate(orgId, sessionId, reason, context) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({
            state: 'awaiting_human',
            verdictReason: `${reason}: ${context}`.slice(0, 500),
          })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async finalize(orgId, sessionId, status, summary, rejectionReason) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({
            state: 'completed',
            verdict: status,
            verdictReason: summary + (rejectionReason ? ` — ${rejectionReason}` : ''),
            completedAt: new Date(),
          })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async scheduleJob(orgId, sessionId, afterSeconds, variant) {
      await boss.send(
        `nilo.${variant}`,
        { orgId, sessionId },
        { startAfter: afterSeconds },
      )
    },
  }
}
