import { describe, it, expect, vi } from 'vitest'
import { createToolExecutor } from './tool-executor.js'
import type { NiloPersistence } from '../types.js'

function makeStore(overrides: Partial<NiloPersistence> = {}): NiloPersistence {
  return {
    getSession: vi.fn(),
    getRecentMessages: vi.fn(),
    setInitiated: vi.fn(),
    setInProgress: vi.fn(),
    incrementReminderCount: vi.fn(),
    persistOutbound: vi.fn(),
    recordAnswer: vi.fn().mockResolvedValue(undefined),
    bumpStuck: vi.fn().mockResolvedValue(1),
    escalate: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    scheduleJob: vi.fn(),
    ...overrides,
  } as unknown as NiloPersistence
}

describe('createToolExecutor', () => {
  it('calls recordAnswer for record_answer tool', async () => {
    const store = makeStore()
    const exec = createToolExecutor('org1', 'sess1', store)
    await exec([{ name: 'record_answer', input: { key: 'licenses', value: ['CE'], confidence: 'high' } }])
    expect(store.recordAnswer).toHaveBeenCalledWith('org1', 'sess1', 'licenses', ['CE'], 'high')
  })

  it('escalates automatically after 3 stuck clarifications', async () => {
    const store = makeStore({ bumpStuck: vi.fn().mockResolvedValue(3) })
    const exec = createToolExecutor('org1', 'sess1', store)
    await exec([{ name: 'request_clarification', input: { key: 'licenses', reason: 'unclear' } }])
    expect(store.escalate).toHaveBeenCalledWith('org1', 'sess1', 'stuck_on_key', expect.stringContaining('licenses'))
  })

  it('returns verdict from finalize_verdict', async () => {
    const store = makeStore()
    const exec = createToolExecutor('org1', 'sess1', store)
    const result = await exec([
      { name: 'finalize_verdict', input: { status: 'qualified', summary: 'Alles ok' } },
    ])
    expect(result.verdict).toBe('qualified')
    expect(store.finalize).toHaveBeenCalledWith('org1', 'sess1', 'qualified', 'Alles ok', undefined)
  })
})
