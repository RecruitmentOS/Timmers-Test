import type { NiloPersistence, NiloConfidence } from '../types.js'
import type { NiloToolCall } from './tools.js'

export function createToolExecutor(
  orgId: string,
  sessionId: string,
  persistence: NiloPersistence,
) {
  return async function applyToolCalls(
    calls: NiloToolCall[],
  ): Promise<{ verdict: 'qualified' | 'rejected' | 'unsure' | null; escalate: string | null }> {
    let verdict: 'qualified' | 'rejected' | 'unsure' | null = null
    let escalate: string | null = null

    for (const call of calls) {
      switch (call.name) {
        case 'record_answer': {
          const key = String(call.input['key'] ?? '')
          const value = call.input['value']
          const confidence = (call.input['confidence'] ?? 'medium') as NiloConfidence
          if (key) await persistence.recordAnswer(orgId, sessionId, key, value, confidence)
          break
        }
        case 'request_clarification': {
          const key = String(call.input['key'] ?? '')
          const count = await persistence.bumpStuck(orgId, sessionId, key)
          if (count >= 3) {
            await persistence.escalate(orgId, sessionId, 'stuck_on_key', `3+ clarifications on ${key}`)
            escalate = 'stuck_on_key'
          }
          break
        }
        case 'escalate_to_human': {
          const reason = String(call.input['reason'] ?? 'unclear_requirements')
          const context = String(call.input['context'] ?? '')
          await persistence.escalate(orgId, sessionId, reason, context)
          escalate = reason
          break
        }
        case 'finalize_verdict': {
          const status = call.input['status'] as 'qualified' | 'rejected' | 'unsure'
          const summary = String(call.input['summary'] ?? '')
          const rejectionReason = call.input['rejection_reason']
            ? String(call.input['rejection_reason'])
            : undefined
          await persistence.finalize(orgId, sessionId, status, summary, rejectionReason)
          verdict = status
          break
        }
      }
    }

    return { verdict, escalate }
  }
}
