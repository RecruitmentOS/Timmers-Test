import type { PgBoss, Job } from 'pg-boss'
import { createDrizzlePersistence } from '../persistence/drizzle-persistence.js'
import { runStartSession, runSendReminder, runProcessInbound } from '../orchestrator.js'
import { withTenantContext } from '../../../lib/with-tenant-context.js'
import { niloSessions, niloMessages } from '../../../db/schema/index.js'
import { eq } from 'drizzle-orm'

type NiloJobData = { orgId: string; sessionId: string }
type NiloInboundData = { orgId: string; sessionId: string; fromPhone: string; body: string; twilioSid?: string }

export async function registerNiloJobs(boss: PgBoss): Promise<void> {
  const persistence = createDrizzlePersistence(boss)

  await boss.work<NiloJobData>('nilo.start', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runStartSession(orgId, sessionId, persistence)
  })

  await boss.work<NiloJobData>('nilo.reminder_24h', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runSendReminder(orgId, sessionId, 'reminder_24h', persistence)
  })

  await boss.work<NiloJobData>('nilo.reminder_72h', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runSendReminder(orgId, sessionId, 'reminder_72h', persistence)
  })

  await boss.work<NiloJobData>('nilo.no_response_farewell', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runSendReminder(orgId, sessionId, 'no_response_farewell', persistence)
  })

  await boss.work<NiloInboundData>('nilo.process_inbound', async (jobs) => {
    for (const job of jobs) {
      const { orgId, sessionId, body, twilioSid } = job.data
      await withTenantContext(orgId, async (tx) => {
        await tx.insert(niloMessages).values({
          organizationId: orgId,
          sessionId,
          direction: 'inbound',
          body,
          twilioSid: twilioSid ?? null,
          isFromBot: false,
        })
        await tx
          .update(niloSessions)
          .set({ lastInboundAt: new Date() })
          .where(eq(niloSessions.id, sessionId))
      })
      await runProcessInbound(orgId, sessionId, persistence)
    }
  })

  console.log('[jobs] registered nilo.start, nilo.reminder_24h/72h, nilo.farewell, nilo.process_inbound')
}
