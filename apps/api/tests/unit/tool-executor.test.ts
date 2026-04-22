// apps/api/tests/unit/tool-executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { createToolExecutor } from "../../src/modules/intake/agent/tool-executor.js";

describe("applyToolCalls", () => {
  const makeStore = () => ({
    recordAnswer: vi.fn().mockResolvedValue(undefined),
    bumpStuck: vi.fn().mockResolvedValue(0),
    escalate: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
  });

  it("records answers and returns no verdict", async () => {
    const store = makeStore();
    const exec = createToolExecutor(store);
    const res = await exec("s1", [
      { name: "record_answer", input: { key: "licenses", value: ["CE"], confidence: "high" } },
    ]);
    expect(store.recordAnswer).toHaveBeenCalledWith("s1", "licenses", ["CE"], "high");
    expect(res.verdict).toBeNull();
  });

  it("escalates when stuck counter reaches 3", async () => {
    const store = makeStore();
    store.bumpStuck.mockResolvedValue(3);
    const exec = createToolExecutor(store);
    const res = await exec("s1", [
      { name: "request_clarification", input: { key: "licenses", reason: "vague" } },
    ]);
    expect(store.escalate).toHaveBeenCalledWith("s1", "stuck_on_key", expect.any(String));
    expect(res.escalate).toBe("stuck_on_key");
  });

  it("finalizes verdict", async () => {
    const store = makeStore();
    const exec = createToolExecutor(store);
    const res = await exec("s1", [
      { name: "finalize_verdict", input: { status: "qualified", summary: "ok" } },
    ]);
    expect(store.finalize).toHaveBeenCalledWith("s1", "qualified", "ok", undefined);
    expect(res.verdict).toBe("qualified");
  });
});
