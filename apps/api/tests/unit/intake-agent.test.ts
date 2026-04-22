// apps/api/tests/unit/intake-agent.test.ts
import { describe, it, expect, vi } from "vitest";
import { processInbound } from "../../src/modules/intake/agent/intake-agent.js";

const baseCtx = {
  sessionId: "s1", orgId: "o1",
  tenantName: "N", clientName: "C",
  vacancyTitle: "T", vacancyDescription: "d",
  criteria: { mustHave: { licenses: ["CE"] }, niceToHave: {} },
  mustHaveAnswers: {},
  niceToHaveAnswers: {},
  stuckCounter: {},
  recentMessages: [{ direction: "inbound" as const, body: "hoi" }],
};

describe("IntakeAgent.processInbound", () => {
  it("executes record_answer + outbound text", async () => {
    const claude = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "text", text: "Top! En heb je CE-rijbewijs?" },
            { type: "tool_use", id: "t1", name: "record_answer", input: { key: "name", value: "Jan", confidence: "high" } },
          ],
          stop_reason: "tool_use",
        }),
      },
    };
    const deps = {
      claude,
      sendWhatsApp: vi.fn().mockResolvedValue({ messageSid: "SM1", status: "sent" }),
      persistOutbound: vi.fn(),
      applyToolCalls: vi.fn().mockResolvedValue({ verdict: null, escalate: null }),
      setSessionInProgress: vi.fn(),
      candidatePhone: "+31600000001",
    };
    await processInbound(baseCtx, deps);
    expect(deps.applyToolCalls).toHaveBeenCalledWith("s1", [
      { name: "record_answer", input: { key: "name", value: "Jan", confidence: "high" } },
    ]);
    expect(deps.sendWhatsApp).toHaveBeenCalledWith({
      toPhone: "+31600000001",
      body: "Top! En heb je CE-rijbewijs?",
    });
    expect(deps.persistOutbound).toHaveBeenCalled();
    expect(deps.setSessionInProgress).toHaveBeenCalledWith("s1");
  });

  it("routes finalize_verdict via applyToolCalls (no outbound text when only verdict)", async () => {
    const claude = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "tool_use", id: "t1", name: "finalize_verdict",
              input: { status: "qualified", summary: "ok" } },
          ],
          stop_reason: "tool_use",
        }),
      },
    };
    const deps = {
      claude,
      sendWhatsApp: vi.fn(),
      persistOutbound: vi.fn(),
      applyToolCalls: vi.fn().mockResolvedValue({ verdict: "qualified", escalate: null }),
      setSessionInProgress: vi.fn(),
      candidatePhone: "+31600000001",
    };
    await processInbound(baseCtx, deps);
    expect(deps.sendWhatsApp).not.toHaveBeenCalled();
    expect(deps.applyToolCalls).toHaveBeenCalled();
  });
});
