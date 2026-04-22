// apps/api/src/modules/intake/agent/tool-executor.ts
import type { ToolName } from "./tools.js";

export interface ToolStore {
  recordAnswer(sessionId: string, key: string, value: unknown, confidence: string): Promise<void>;
  bumpStuck(sessionId: string, key: string): Promise<number>;  // returns new count
  escalate(sessionId: string, reason: string, context: string): Promise<void>;
  finalize(sessionId: string, status: "qualified" | "rejected" | "unsure", summary: string, rejectionReason?: string): Promise<void>;
}

export type ToolCall = { name: ToolName; input: Record<string, unknown> };

export function createToolExecutor(store: ToolStore) {
  return async function applyToolCalls(
    sessionId: string,
    calls: ToolCall[],
  ): Promise<{ verdict: "qualified" | "rejected" | "unsure" | null; escalate: string | null }> {
    let verdict: "qualified" | "rejected" | "unsure" | null = null;
    let escalate: string | null = null;

    for (const call of calls) {
      switch (call.name) {
        case "record_answer": {
          const key = String(call.input.key ?? "");
          const value = call.input.value;
          const confidence = String(call.input.confidence ?? "medium");
          if (key) await store.recordAnswer(sessionId, key, value, confidence);
          break;
        }
        case "request_clarification": {
          const key = String(call.input.key ?? "");
          const count = await store.bumpStuck(sessionId, key);
          if (count >= 3) {
            await store.escalate(sessionId, "stuck_on_key", `3+ clarifications on ${key}`);
            escalate = "stuck_on_key";
          }
          break;
        }
        case "escalate_to_human": {
          const reason = String(call.input.reason ?? "unclear_requirements");
          const context = String(call.input.context ?? "");
          await store.escalate(sessionId, reason, context);
          escalate = reason;
          break;
        }
        case "finalize_verdict": {
          const status = call.input.status as "qualified" | "rejected" | "unsure";
          const summary = String(call.input.summary ?? "");
          const rejectionReason = call.input.rejection_reason ? String(call.input.rejection_reason) : undefined;
          await store.finalize(sessionId, status, summary, rejectionReason);
          verdict = status;
          break;
        }
      }
    }

    return { verdict, escalate };
  };
}
