import Anthropic from '@anthropic-ai/sdk'
import { startSession, sendReminder, sendFarewell, processInbound } from '@hey-nilo/core'
import { createTwilioSandboxGateway } from '../intake/whatsapp/twilio-sandbox.js'
import type { NiloPersistence } from '@hey-nilo/core'
import { resolveFlow } from './flow-registry.js'
import { fireWebhookAndNotify } from './outbound.js'

function getGateway() {
  return createTwilioSandboxGateway({
    accountSid: process.env['TWILIO_ACCOUNT_SID']!,
    authToken: process.env['TWILIO_AUTH_TOKEN']!,
    fromNumber: process.env['TWILIO_WHATSAPP_FROM'] ?? 'whatsapp:+14155238886',
  })
}

export async function runStartSession(
  orgId: string,
  sessionId: string,
  persistence: NiloPersistence,
): Promise<void> {
  const flow = resolveFlow(orgId)
  if (!flow) throw new Error(`no flow configured for org ${orgId}`)
  await startSession(orgId, sessionId, flow, getGateway(), persistence)
}

export async function runSendReminder(
  orgId: string,
  sessionId: string,
  variant: string,
  persistence: NiloPersistence,
): Promise<void> {
  const flow = resolveFlow(orgId)
  if (!flow) throw new Error(`no flow configured for org ${orgId}`)

  if (variant === 'no_response_farewell') {
    await sendFarewell(orgId, sessionId, flow, getGateway(), persistence)
    await fireWebhookAndNotify(orgId, sessionId, flow, persistence)
  } else {
    await sendReminder(orgId, sessionId, variant, flow, getGateway(), persistence)
  }
}

export async function runProcessInbound(
  orgId: string,
  sessionId: string,
  persistence: NiloPersistence,
): Promise<void> {
  const flow = resolveFlow(orgId)
  if (!flow) throw new Error(`no flow configured for org ${orgId}`)

  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return
  if (session.state === 'completed' || session.state === 'awaiting_human') return

  const recentMessages = await persistence.getRecentMessages(orgId, sessionId)
  // nilo-core pins @anthropic-ai/sdk ^0.30; api uses ^0.87 — minor RequestOptions
  // generic mismatch at the type level only; runtime-compatible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claude = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY']! }) as any

  await processInbound(
    {
      orgId,
      sessionId,
      tenantName: flow.name,
      vacancyTitle: String(session.context['vacancy_title'] ?? ''),
      vacancyDescription: String(session.context['vacancy_description'] ?? '') || null,
      criteria: flow.criteria,
      answeredMustHaves: session.answers,
      answeredNiceToHaves: {},
      stuckCounter: session.stuckCounter,
      recentMessages,
      contactPhone: session.contactPhone,
      systemPromptExtra: flow.systemPromptExtra,
    },
    {
      claude,
      sendWhatsApp: (input) => getGateway().send(input),
      persistence,
    },
  )

  const updated = await persistence.getSession(orgId, sessionId)
  if (updated?.state === 'completed') {
    await fireWebhookAndNotify(orgId, sessionId, flow, persistence)
  }
}
