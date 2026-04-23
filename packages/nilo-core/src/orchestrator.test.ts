import { describe, it, expect, vi } from 'vitest'
import { startSession, sendReminder } from './orchestrator.js'
import type { NiloPersistence, NiloFlow, NiloSession } from './types.js'

const baseFlow: NiloFlow = {
  id: 'f1',
  orgId: 'org1',
  name: 'Timmers',
  locale: 'nl',
  criteria: { mustHave: {} },
  templates: {
    first_contact: 'Hoi {{candidate.first_name}}! Vacature: {{vacancy.title}}',
    reminder_24h: 'Reminder {{candidate.first_name}}',
    reminder_72h: 'Laatste kans',
    no_response_farewell: 'Helaas',
  },
  reminderChain: [
    { afterSeconds: 86400, variant: 'reminder_24h' },
    { afterSeconds: 172800, variant: 'reminder_72h' },
    { afterSeconds: 86400, variant: 'no_response_farewell' },
  ],
}

const baseSession: NiloSession = {
  id: 'sess1',
  orgId: 'org1',
  flowId: null,
  contactPhone: '+31612345678',
  contactName: 'Jan de Vries',
  context: { vacancy_title: 'Chauffeur CE' },
  state: 'created',
  verdict: null,
  verdictReason: null,
  answers: {},
  stuckCounter: {},
  reminderCount: 0,
  matchScore: null,
  outboundWebhookUrl: null,
  createdAt: new Date(),
  initiatedAt: null,
  completedAt: null,
  lastInboundAt: null,
  lastOutboundAt: null,
}

function makeStore(overrides: Partial<NiloPersistence> = {}): NiloPersistence {
  return {
    getSession: vi.fn().mockResolvedValue(baseSession),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    setInitiated: vi.fn().mockResolvedValue(undefined),
    setInProgress: vi.fn(),
    incrementReminderCount: vi.fn().mockResolvedValue(undefined),
    persistOutbound: vi.fn().mockResolvedValue(undefined),
    recordAnswer: vi.fn(),
    bumpStuck: vi.fn(),
    escalate: vi.fn(),
    finalize: vi.fn(),
    scheduleJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as NiloPersistence
}

const makeGateway = () => ({
  send: vi.fn().mockResolvedValue({ messageSid: 'SM1', status: 'sent' }),
})

describe('startSession', () => {
  it('sends first_contact template and schedules first reminder', async () => {
    const store = makeStore()
    const gateway = makeGateway()
    await startSession('org1', 'sess1', baseFlow, gateway, store)
    expect(gateway.send).toHaveBeenCalledWith({
      toPhone: '+31612345678',
      body: 'Hoi Jan! Vacature: Chauffeur CE',
    })
    expect(store.persistOutbound).toHaveBeenCalledWith(
      'org1',
      'sess1',
      'Hoi Jan! Vacature: Chauffeur CE',
      'SM1',
    )
    expect(store.setInitiated).toHaveBeenCalledWith('org1', 'sess1')
    expect(store.scheduleJob).toHaveBeenCalledWith('org1', 'sess1', 86400, 'reminder_24h')
  })
})

describe('sendReminder', () => {
  it('skips if session already replied', async () => {
    const store = makeStore({
      getSession: vi.fn().mockResolvedValue({
        ...baseSession,
        state: 'in_progress',
        lastInboundAt: new Date(),
      }),
    })
    const gateway = makeGateway()
    await sendReminder('org1', 'sess1', 'reminder_24h', baseFlow, gateway, store)
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('sends reminder and schedules the next one in the chain', async () => {
    const store = makeStore()
    const gateway = makeGateway()
    await sendReminder('org1', 'sess1', 'reminder_24h', baseFlow, gateway, store)
    expect(gateway.send).toHaveBeenCalledWith({
      toPhone: '+31612345678',
      body: 'Reminder Jan',
    })
    expect(store.scheduleJob).toHaveBeenCalledWith('org1', 'sess1', 172800, 'reminder_72h')
  })
})
