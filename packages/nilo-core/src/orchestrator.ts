import type { NiloPersistence, NiloFlow } from './types.js'
import { renderTemplate, buildTemplateContext } from './renderer.js'
import type { WhatsAppGateway } from './gateway.js'

type MinimalGateway = Pick<WhatsAppGateway, 'send'>

export async function startSession(
  orgId: string,
  sessionId: string,
  flow: NiloFlow,
  gateway: MinimalGateway,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) throw new Error(`session not found: ${sessionId}`)
  if (session.state !== 'created') return

  const template = flow.templates['first_contact']
  if (!template) throw new Error(`template first_contact missing in flow ${flow.id}`)

  const ctx = buildTemplateContext(session, flow)
  const body = renderTemplate(template, ctx)
  const result = await gateway.send({ toPhone: session.contactPhone, body })

  await persistence.persistOutbound(orgId, sessionId, body, result.messageSid)
  await persistence.setInitiated(orgId, sessionId)

  const firstStep = flow.reminderChain[0]
  if (firstStep) {
    await persistence.scheduleJob(orgId, sessionId, firstStep.afterSeconds, firstStep.variant)
  }
}

export async function sendReminder(
  orgId: string,
  sessionId: string,
  variant: string,
  flow: NiloFlow,
  gateway: MinimalGateway,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return
  // strict > is intentional: a reply must postdate session creation by at least 1ms
  if (session.lastInboundAt && session.lastInboundAt > session.createdAt) return
  if (session.state === 'completed' || session.state === 'awaiting_human') return

  const template = flow.templates[variant]
  if (!template) throw new Error(`template ${variant} missing in flow ${flow.id}`)

  const ctx = buildTemplateContext(session, flow)
  const body = renderTemplate(template, ctx)
  const result = await gateway.send({ toPhone: session.contactPhone, body })

  await persistence.persistOutbound(orgId, sessionId, body, result.messageSid)
  await persistence.incrementReminderCount(orgId, sessionId)

  const currentIndex = flow.reminderChain.findIndex((s) => s.variant === variant)
  const nextStep = flow.reminderChain[currentIndex + 1]
  if (nextStep) {
    await persistence.scheduleJob(orgId, sessionId, nextStep.afterSeconds, nextStep.variant)
  }
}

export async function sendFarewell(
  orgId: string,
  sessionId: string,
  flow: NiloFlow,
  gateway: MinimalGateway,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return
  // strict > is intentional: a reply must postdate session creation by at least 1ms
  if (session.lastInboundAt && session.lastInboundAt > session.createdAt) return
  if (session.state === 'completed' || session.state === 'awaiting_human') return

  const template = flow.templates['no_response_farewell']
  if (!template) throw new Error(`template no_response_farewell missing in flow ${flow.id}`)

  const ctx = buildTemplateContext(session, flow)
  const body = renderTemplate(template, ctx)
  const result = await gateway.send({ toPhone: session.contactPhone, body })

  await persistence.persistOutbound(orgId, sessionId, body, result.messageSid)
  await persistence.finalize(orgId, sessionId, 'rejected', 'no_response_farewell', 'no response')
}
