import { describe, it, expect, vi } from 'vitest'
import { processInbound } from './agent.js'
import type { NiloPersistence, NiloCriteria } from '../types.js'

const mockClaude = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Heb je een rijbewijs CE?' }],
    }),
  },
}

function makeStore(): NiloPersistence {
  return {
    getSession: vi.fn(),
    getRecentMessages: vi.fn(),
    setInitiated: vi.fn(),
    setInProgress: vi.fn().mockResolvedValue(undefined),
    incrementReminderCount: vi.fn(),
    persistOutbound: vi.fn().mockResolvedValue(undefined),
    recordAnswer: vi.fn(),
    bumpStuck: vi.fn(),
    escalate: vi.fn(),
    finalize: vi.fn(),
    scheduleJob: vi.fn(),
  } as unknown as NiloPersistence
}

const baseCriteria: NiloCriteria = {
  mustHave: { customKeys: [{ key: 'license', question: 'CE rijbewijs?', required: true }] },
}

describe('processInbound', () => {
  it('sends Claude response via WhatsApp and persists outbound', async () => {
    const store = makeStore()
    const sendWhatsApp = vi.fn().mockResolvedValue({ messageSid: 'SM1', status: 'sent' })

    await processInbound(
      {
        orgId: 'org1',
        sessionId: 'sess1',
        tenantName: 'Timmers',
        vacancyTitle: 'Chauffeur CE',
        criteria: baseCriteria,
        answeredMustHaves: {},
        answeredNiceToHaves: {},
        stuckCounter: {},
        recentMessages: [{ direction: 'inbound', body: 'Ja ik heb interesse' }],
        contactPhone: '+31612345678',
      },
      { claude: mockClaude as any, sendWhatsApp, persistence: store },
    )

    expect(sendWhatsApp).toHaveBeenCalledWith({
      toPhone: '+31612345678',
      body: 'Heb je een rijbewijs CE?',
    })
    expect(store.persistOutbound).toHaveBeenCalledWith(
      'org1', 'sess1', 'Heb je een rijbewijs CE?', 'SM1', [],
    )
    expect(store.setInProgress).toHaveBeenCalledWith('org1', 'sess1')
  })

  it('persists tool calls even when Claude sends no text', async () => {
    const toolOnlyClaude = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              id: 'tu1',
              name: 'finalize_verdict',
              input: { status: 'qualified', summary: 'Alles ok' },
            },
          ],
        }),
      },
    }
    const store = makeStore()
    const sendWhatsApp = vi.fn()

    await processInbound(
      {
        orgId: 'org1',
        sessionId: 'sess1',
        tenantName: 'Timmers',
        vacancyTitle: 'Chauffeur CE',
        criteria: baseCriteria,
        answeredMustHaves: {},
        answeredNiceToHaves: {},
        stuckCounter: {},
        recentMessages: [{ direction: 'inbound', body: 'Ja' }],
        contactPhone: '+31612345678',
      },
      { claude: toolOnlyClaude as any, sendWhatsApp, persistence: store },
    )

    expect(sendWhatsApp).not.toHaveBeenCalled()
    expect(store.persistOutbound).toHaveBeenCalledWith(
      'org1', 'sess1', '', '', [{ name: 'finalize_verdict', input: { status: 'qualified', summary: 'Alles ok' } }],
    )
    expect(store.setInProgress).toHaveBeenCalledWith('org1', 'sess1')
  })
})
