import { niloWebhookLogs } from '../../db/schema/index.js'
import { withTenantContext } from '../../lib/with-tenant-context.js'
import { createHmac } from 'node:crypto'
import type { NiloFlow, NiloPersistence } from '@hey-nilo/core'

export async function fireWebhookAndNotify(
  orgId: string,
  sessionId: string,
  flow: NiloFlow,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return

  const webhookUrl = session.outboundWebhookUrl ?? flow.webhookUrl
  if (webhookUrl) {
    await fireWebhook(orgId, sessionId, webhookUrl, session)
  }

  if (
    flow.slackWebhookUrl &&
    session.verdict === 'qualified' &&
    (session.matchScore ?? 0) >= (flow.scoreThreshold ?? 75)
  ) {
    await fireSlackAlert(flow.slackWebhookUrl, session)
  }
}

async function fireWebhook(
  orgId: string,
  sessionId: string,
  targetUrl: string,
  session: Awaited<ReturnType<NiloPersistence['getSession']>>,
): Promise<void> {
  if (!session) return

  const payload = {
    event: 'session.completed',
    session_id: session.id,
    external_ref: (session.context['external_ref'] as string) ?? null,
    verdict: session.verdict,
    verdict_reason: session.verdictReason,
    match_score: session.matchScore,
    answers: session.answers,
    contact: { phone: session.contactPhone, name: session.contactName },
    context: session.context,
    completed_at: session.completedAt?.toISOString() ?? new Date().toISOString(),
  }

  const body = JSON.stringify(payload)
  const secret = process.env['NILO_WEBHOOK_SECRET']
  const signature = secret
    ? `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    : undefined

  let attempt = 0
  let lastError: string | undefined
  let responseStatus: number | undefined

  for (let i = 1; i <= 3; i++) {
    attempt = i
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Nilo-Signature': signature } : {}),
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      responseStatus = res.status
      if (res.ok) {
        await withTenantContext(orgId, async (tx) => {
          await tx.insert(niloWebhookLogs).values({
            organizationId: orgId,
            sessionId,
            targetUrl,
            payload,
            responseStatus,
            attempt,
            deliveredAt: new Date(),
          })
        })
        return
      }
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = String(err)
    }
    await new Promise((r) => setTimeout(r, attempt * 1000))
  }

  await withTenantContext(orgId, async (tx) => {
    await tx.insert(niloWebhookLogs).values({
      organizationId: orgId,
      sessionId,
      targetUrl,
      payload,
      responseStatus,
      attempt,
      error: lastError,
    })
  })
}

async function fireSlackAlert(
  slackWebhookUrl: string,
  session: Awaited<ReturnType<NiloPersistence['getSession']>>,
): Promise<void> {
  if (!session) return
  const score = session.matchScore ?? '?'
  const title = String(session.context['vacancy_title'] ?? 'vacature')
  const source = String(session.context['source'] ?? '')
  const answerSummary = Object.entries(session.answers)
    .map(([k, v]) => `${k}: ${JSON.stringify((v as { value: unknown }).value)}`)
    .join(', ')

  try {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `✅ Sterke kandidaat: ${score}% match\n*${session.contactName ?? session.contactPhone}* voor *${title}*${source ? ` | Bron: ${source}` : ''}\n${answerSummary}`,
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    console.error('[nilo] slack alert failed:', err)
  }
}
