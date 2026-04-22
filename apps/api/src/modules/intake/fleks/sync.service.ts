import type { FleksClient } from "./client.js";
import type { FleksJobCandidate } from "@recruitment-os/types";

export interface SyncStorage {
  loadCursor(orgId: string, entity: string): Promise<string | null>;
  saveCursor(orgId: string, entity: string, cursor: string, seenIds?: string[]): Promise<void>;
  upsertVacancyFromFleks(orgId: string, job: { uuid: string; functionName: string; functionDescription: string | null }): Promise<{ id: string; intakeEnabled: boolean }>;
  findActiveIntakeVacancies(orgId: string): Promise<Array<{ id: string; fleksJobUuid: string }>>;
  isCandidateKnown(orgId: string, fleksEmployeeUuid: string): Promise<boolean>;
  createCandidateAndSession(orgId: string, input: {
    vacancyId: string;
    fleksEmployee: FleksJobCandidate;
  }): Promise<{ sessionId: string }>;
}

export type EnqueueFn = (jobName: string, payload: Record<string, unknown>) => Promise<void>;

export interface SyncTickDeps {
  orgId: string;
  client: FleksClient;
  storage: SyncStorage;
  enqueue: EnqueueFn;
}

export async function syncTick(deps: SyncTickDeps): Promise<{
  vacanciesProcessed: number;
  newCandidates: number;
}> {
  const { orgId, client, storage, enqueue } = deps;

  // 1. Sync jobs (update vacancies that have fleksJobUuid)
  const jobsCursor = await storage.loadCursor(orgId, "jobs");
  const jobsResp = await client.listJobs({
    isArchived: false,
    updatedAtMin: jobsCursor ?? undefined,
    limit: 100,
  });
  for (const job of jobsResp.data) {
    await storage.upsertVacancyFromFleks(orgId, {
      uuid: job.uuid,
      functionName: job.functionName,
      functionDescription: job.functionDescription,
    });
  }
  await storage.saveCursor(orgId, "jobs", new Date().toISOString());

  // 2. Per active-intake vacancy, fetch job-candidates
  const activeVacs = await storage.findActiveIntakeVacancies(orgId);
  let newCandidates = 0;
  for (const vac of activeVacs) {
    const resp = await client.listJobCandidates({
      jobUUID: vac.fleksJobUuid,
      isQualified: true,
      isInvited: false,
      hasActiveContract: false,
      limit: 100,
    });
    for (const cand of resp.data) {
      const known = await storage.isCandidateKnown(orgId, cand.uuid);
      if (known) continue;
      const { sessionId } = await storage.createCandidateAndSession(orgId, {
        vacancyId: vac.id,
        fleksEmployee: cand,
      });
      await enqueue("intake.start", { sessionId });
      newCandidates += 1;
    }
  }
  await storage.saveCursor(orgId, "job_candidates", new Date().toISOString());

  return { vacanciesProcessed: activeVacs.length, newCandidates };
}
