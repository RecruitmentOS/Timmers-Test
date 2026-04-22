import { eq } from "drizzle-orm";
import type { PgBoss, Job } from "pg-boss";
import { createFleksClient } from "../modules/intake/fleks/client.js";
import { createSyncStorage } from "../modules/intake/fleks/sync-storage.js";
import { syncTick } from "../modules/intake/fleks/sync.service.js";
import { db } from "../db/index.js";
import { externalIntegrations } from "../db/schema/external-integrations.js";
import { decryptSecret } from "../lib/crypto.js";

// ============================================================
// Fleks sync jobs
//
// fleks.sync-scheduler — cron every 5 min, fans out one
//   fleks.sync-tick job per active Fleks integration org.
// fleks.sync-tick      — processes a single org: fetches new
//   job orders + candidates from Fleks API and upserts locally.
// ============================================================

const SYNC_TICK_JOB = "fleks.sync-tick";
const SYNC_SCHEDULER_JOB = "fleks.sync-scheduler";

type SyncTickData = { orgId: string };
type EmptyData = Record<string, never>;

/**
 * Register Fleks sync jobs with pg-boss.
 *
 * - fleks.sync-scheduler: cron at every-5-min, fans out per-org tick jobs.
 * - fleks.sync-tick: per-org worker that calls syncTick().
 */
export async function registerFleksSyncJob(boss: PgBoss): Promise<void> {
  // Per-org sync worker — processes one org per job.
  await boss.work<SyncTickData>(
    SYNC_TICK_JOB,
    async ([job]: Job<SyncTickData>[]) => {
      const { orgId } = job.data;
      try {
        const [integ] = await db
          .select()
          .from(externalIntegrations)
          .where(eq(externalIntegrations.organizationId, orgId))
          .limit(1);

        if (!integ || !integ.isActive) {
          console.log(`[fleks-sync] skip org ${orgId} — no active integration`);
          return;
        }

        const apiKey =
          process.env.FLEKS_API_KEY ??
          (integ.apiKeyEncrypted ? decryptSecret(integ.apiKeyEncrypted) : null);

        if (!apiKey) {
          console.log(`[fleks-sync] skip org ${orgId} — no API key`);
          return;
        }

        const baseUrl = integ.apiBaseUrl ?? "https://api.external.fleks.works";
        const client = createFleksClient({ apiKey, baseUrl });
        const storage = createSyncStorage();

        const result = await syncTick({
          orgId,
          client,
          storage,
          enqueue: async (name, payload) => {
            await boss.send(name, payload);
          },
        });

        console.log(`[fleks-sync] org ${orgId}:`, result);
      } catch (err) {
        console.error(`[fleks-sync] org ${orgId} failed:`, err);
        throw err; // pg-boss will retry
      }
    }
  );

  // Scheduler — runs every 5 minutes, enqueues one sync-tick per active Fleks org.
  await boss.schedule(SYNC_SCHEDULER_JOB, "*/5 * * * *", {});
  await boss.work<EmptyData>(
    SYNC_SCHEDULER_JOB,
    async (_jobs: Job<EmptyData>[]) => {
      const rows = await db
        .select({ organizationId: externalIntegrations.organizationId })
        .from(externalIntegrations)
        .where(eq(externalIntegrations.isActive, true));

      const orgIds = [...new Set(rows.map((r) => r.organizationId))];

      for (const orgId of orgIds) {
        await boss.send(SYNC_TICK_JOB, { orgId });
      }

      console.log(
        `[fleks-sync] scheduler dispatched ${orgIds.length} sync-tick jobs`
      );
    }
  );

  console.log("[jobs] registered fleks.sync-tick + fleks.sync-scheduler");
}
