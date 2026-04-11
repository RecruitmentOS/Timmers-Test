import type { PgBoss, Job } from "pg-boss";
import { syncAllActiveCampaigns } from "../services/meta-insights.service.js";

// ============================================================
// Meta Insights sync — daily pg-boss recurring job
// Runs at 06:00 UTC to catch previous day's final metrics
// ============================================================

type EmptyData = Record<string, never>;

/**
 * Register the Meta Insights sync job with pg-boss.
 * Follows billing-jobs.ts pattern for job registration.
 */
export async function registerMetaInsightsJobs(boss: PgBoss): Promise<void> {
  // Schedule daily at 06:00 UTC
  await boss.schedule("meta-insights-sync", "0 6 * * *");

  await boss.work<EmptyData>(
    "meta-insights-sync",
    async (_jobs: Job<EmptyData>[]) => {
      console.log("[Meta Insights] Starting daily sync...");
      try {
        const result = await syncAllActiveCampaigns();
        console.log(
          `[Meta Insights] Daily sync completed: ${result.synced} synced, ${result.errors} errors`
        );
      } catch (err) {
        console.error("[Meta Insights] Daily sync failed:", err);
        throw err; // pg-boss will retry
      }
    }
  );
}
