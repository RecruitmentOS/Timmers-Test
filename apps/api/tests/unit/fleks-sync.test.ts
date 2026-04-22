import { describe, it, expect, vi } from "vitest";
import { syncTick } from "../../src/modules/intake/fleks/sync.service.js";
import type { FleksClient } from "../../src/modules/intake/fleks/client.js";

describe("FleksSyncService.syncTick", () => {
  const makeDeps = () => {
    const client: Partial<FleksClient> = {
      listJobs: vi.fn().mockResolvedValue({ data: [], page: 1, limit: 100 }),
      listJobCandidates: vi.fn().mockResolvedValue({ data: [], page: 1, limit: 100 }),
      getEmployee: vi.fn(),
    };
    const storage = {
      loadCursor: vi.fn().mockResolvedValue(null),
      saveCursor: vi.fn().mockResolvedValue(undefined),
      upsertVacancyFromFleks: vi.fn().mockResolvedValue({ id: "v1", intakeEnabled: true }),
      findActiveIntakeVacancies: vi.fn().mockResolvedValue([
        { id: "v1", fleksJobUuid: "job1" },
      ]),
      isCandidateKnown: vi.fn().mockResolvedValue(false),
      createCandidateAndSession: vi.fn().mockResolvedValue({ sessionId: "s1" }),
    };
    const enqueue = vi.fn().mockResolvedValue(undefined);
    return { client: client as FleksClient, storage, enqueue };
  };

  it("creates candidate + session for new Fleks job-candidate", async () => {
    const { client, storage, enqueue } = makeDeps();
    (client.listJobCandidates as any).mockResolvedValue({
      data: [{ uuid: "emp1", jobUUID: "job1", firstName: "A", lastName: "B", phoneNumber: "+31600000001" }],
      page: 1, limit: 100,
    });
    await syncTick({ orgId: "org1", client, storage, enqueue });
    expect(storage.createCandidateAndSession).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith("intake.start", { sessionId: "s1" });
  });

  it("skips known candidates (idempotent)", async () => {
    const { client, storage, enqueue } = makeDeps();
    (client.listJobCandidates as any).mockResolvedValue({
      data: [{ uuid: "emp1", jobUUID: "job1", firstName: "A", lastName: "B" }],
      page: 1, limit: 100,
    });
    (storage.isCandidateKnown as any).mockResolvedValue(true);
    await syncTick({ orgId: "org1", client, storage, enqueue });
    expect(storage.createCandidateAndSession).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
