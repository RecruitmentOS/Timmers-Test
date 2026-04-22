import { describe, it, expect, vi } from "vitest";
import { startSession } from "../../src/modules/intake/orchestrator.js";

describe("IntakeOrchestrator.startSession", () => {
  const makeDeps = () => ({
    loadSessionContext: vi.fn().mockResolvedValue({
      sessionId: "s1", orgId: "o1",
      candidate: { first_name: "Jan", full_name: "Jan de Vries", phone: "+31600000001" },
      vacancy: { title: "T", location: "U", start_date: null },
      client: { name: "C" },
      tenant: { name: "N" },
      recruiter: { name: "R", phone: "+31600000002" },
    }),
    loadTemplate: vi.fn().mockResolvedValue({ body: "Hoi {{candidate.first_name}}" }),
    sendWhatsApp: vi.fn().mockResolvedValue({ messageSid: "SM1", status: "sent" }),
    persistOutbound: vi.fn().mockResolvedValue(undefined),
    scheduleReminder: vi.fn().mockResolvedValue(undefined),
  });

  it("sends first-contact template and schedules 24h reminder", async () => {
    const deps = makeDeps();
    await startSession("s1", deps);
    expect(deps.sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      toPhone: "+31600000001", body: "Hoi Jan",
    }));
    expect(deps.persistOutbound).toHaveBeenCalledWith({
      sessionId: "s1", body: "Hoi Jan", twilioSid: "SM1",
    });
    expect(deps.scheduleReminder).toHaveBeenCalledWith({
      sessionId: "s1", afterSeconds: 86400, variant: "reminder_24h",
    });
  });
});
