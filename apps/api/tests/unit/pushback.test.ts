// apps/api/tests/unit/pushback.test.ts
import { describe, it, expect, vi } from "vitest";
import { pushVerdictToFleks } from "../../src/modules/intake/pushback.service.js";

describe("pushVerdictToFleks", () => {
  it("calls updateEmployee with recruitment_os_status free-field", async () => {
    const client = { updateEmployee: vi.fn().mockResolvedValue(undefined) };
    await pushVerdictToFleks(client as any, "emp-uuid", "qualified");
    expect(client.updateEmployee).toHaveBeenCalledWith("emp-uuid", {
      additionalFields: { recruitment_os_status: "qualified" },
    });
  });
});
