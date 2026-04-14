import { type PgBoss, type Job } from "pg-boss";
import { db } from "../db/index.js";
import { organization } from "../db/schema/auth.js";
import { gdprService } from "../services/gdpr.service.js";

// ============================================================
// Data retention cron job — GDPR-05
// Flags candidates inactive >12 months with "retention-flagged" tag.
// ============================================================

type EmptyData = Record<string, never>;

/**
 * Register the data retention cron job with pg-boss.
 * Runs daily at 03:00 UTC — iterates all organizations.
 */
export async function registerDataRetentionJob(boss: PgBoss): Promise<void> {
  await boss.schedule("data-retention-check", "0 3 * * *");
  await boss.work<EmptyData>(
    "data-retention-check",
    async (_jobs: Job<EmptyData>[]) => {
      console.log("[GDPR] Running data retention check...");
      try {
        // Query all organizations (global table, no RLS)
        const orgs = await db.select({ id: organization.id }).from(organization);

        let totalFlagged = 0;
        for (const org of orgs) {
          const count = await gdprService.flagInactiveCandidates(org.id);
          if (count > 0) {
            console.log(
              `[GDPR] Flagged ${count} inactive candidates in org ${org.id}`
            );
          }
          totalFlagged += count;
        }

        console.log(
          `[GDPR] Data retention check complete — ${totalFlagged} candidates flagged across ${orgs.length} orgs`
        );
      } catch (err) {
        console.error("[GDPR] Data retention check failed:", err);
        throw err; // pg-boss will retry
      }
    }
  );
}
