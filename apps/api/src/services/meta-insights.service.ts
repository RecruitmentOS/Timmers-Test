import { eq, and, sql, isNotNull, sum } from "drizzle-orm";
import { getMetaConnection } from "./meta-connection.service.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { db } from "../db/index.js";
import {
  campaigns,
  campaignDailyMetrics,
} from "../db/schema/campaigns.js";

// ============================================================
// Meta Insights API sync service (CAMP-08)
// Fetches campaign metrics from Meta and upserts into daily_metrics
// ============================================================

/**
 * Sync Insights for a single campaign from Meta API.
 * Fetches last 7 days of data (to catch late-arriving metrics),
 * upserts into campaign_daily_metrics, and rolls up totals.
 */
export async function syncCampaignInsights(
  orgId: string,
  campaignId: string,
  metaCampaignId: string
): Promise<void> {
  const connection = await getMetaConnection(orgId);
  if (!connection) {
    throw new Error("Meta connection not configured for this organization");
  }

  try {
    const { FacebookAdsApi, Campaign } = await import(
      "facebook-nodejs-business-sdk"
    );
    FacebookAdsApi.init(connection.accessToken);

    const campaign = new Campaign(metaCampaignId);

    // Fetch last 7 days of insights to catch late-arriving data
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);
    const timeRange = {
      since: sevenDaysAgo.toISOString().split("T")[0],
      until: today.toISOString().split("T")[0],
    };

    const insights = await campaign.getInsights(
      ["spend", "impressions", "clicks", "reach", "actions"],
      {
        time_range: timeRange,
        time_increment: 1, // daily breakdown
      }
    );

    // Upsert each day's metrics
    for (const day of insights) {
      const date = day.date_start; // YYYY-MM-DD
      const spendCents = Math.round(parseFloat(day.spend || "0") * 100);
      const impressions = parseInt(day.impressions || "0", 10);
      const clicks = parseInt(day.clicks || "0", 10);
      const reach = parseInt(day.reach || "0", 10);
      const actions = day.actions || null;

      await withTenantContext(orgId, async (tx) => {
        // Check if record exists for this campaign+date
        const existing = await tx
          .select({ id: campaignDailyMetrics.id })
          .from(campaignDailyMetrics)
          .where(
            and(
              eq(campaignDailyMetrics.campaignId, campaignId),
              eq(campaignDailyMetrics.date, date)
            )
          );

        if (existing.length > 0) {
          await tx
            .update(campaignDailyMetrics)
            .set({ spendCents, impressions, clicks, reach, actions })
            .where(eq(campaignDailyMetrics.id, existing[0].id));
        } else {
          await tx.insert(campaignDailyMetrics).values({
            organizationId: orgId,
            campaignId,
            date,
            spendCents,
            impressions,
            clicks,
            reach,
            actions,
          });
        }
      });
    }

    // Roll up totals from daily metrics into campaign aggregate fields
    await withTenantContext(orgId, async (tx) => {
      const [totals] = await tx
        .select({
          totalSpend: sum(campaignDailyMetrics.spendCents),
          totalClicks: sum(campaignDailyMetrics.clicks),
          totalImpressions: sum(campaignDailyMetrics.impressions),
        })
        .from(campaignDailyMetrics)
        .where(eq(campaignDailyMetrics.campaignId, campaignId));

      await tx
        .update(campaigns)
        .set({
          spendCents: parseInt(String(totals?.totalSpend ?? "0"), 10),
          clicks: parseInt(String(totals?.totalClicks ?? "0"), 10),
          impressions: parseInt(String(totals?.totalImpressions ?? "0"), 10),
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
    });

    console.log(
      `[Meta Insights] Synced ${insights.length} days for campaign ${campaignId}`
    );
  } catch (error: any) {
    console.error(
      `[Meta Insights] Failed to sync campaign ${campaignId}:`,
      error.message
    );
    throw error;
  }
}

/**
 * Sync all active Meta campaigns across all organizations.
 * Groups by org to reuse Meta connection per tenant.
 * Adds small delay between orgs to respect rate limits.
 */
export async function syncAllActiveCampaigns(): Promise<{
  synced: number;
  errors: number;
}> {
  let synced = 0;
  let errors = 0;

  // Query all active campaigns with Meta IDs (no RLS — cross-tenant job)
  const activeCampaigns = await db
    .select({
      id: campaigns.id,
      organizationId: campaigns.organizationId,
      metaCampaignId: campaigns.metaCampaignId,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "active"),
        isNotNull(campaigns.metaCampaignId)
      )
    );

  if (activeCampaigns.length === 0) {
    console.log("[Meta Insights] No active Meta campaigns to sync");
    return { synced: 0, errors: 0 };
  }

  // Group by organization
  const byOrg = new Map<
    string,
    Array<{ id: string; metaCampaignId: string }>
  >();

  for (const c of activeCampaigns) {
    const list = byOrg.get(c.organizationId) || [];
    list.push({ id: c.id, metaCampaignId: c.metaCampaignId! });
    byOrg.set(c.organizationId, list);
  }

  // Process each org sequentially with delay between orgs
  let orgIndex = 0;
  for (const [orgId, orgCampaigns] of byOrg) {
    // Small delay between orgs to respect Meta rate limits
    if (orgIndex > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    orgIndex++;

    // Check if this org has a valid Meta connection
    const connection = await getMetaConnection(orgId);
    if (!connection) {
      console.warn(
        `[Meta Insights] Skipping org ${orgId}: no Meta connection`
      );
      continue;
    }

    // Sync each campaign for this org sequentially
    for (const campaign of orgCampaigns) {
      try {
        await syncCampaignInsights(
          orgId,
          campaign.id,
          campaign.metaCampaignId
        );
        synced++;
      } catch (error: any) {
        errors++;
        console.error(
          `[Meta Insights] Error syncing campaign ${campaign.id} for org ${orgId}:`,
          error.message
        );
        // Continue with next campaign — don't let one failure block others
      }
    }
  }

  console.log(
    `[Meta Insights] Sync complete: ${synced} synced, ${errors} errors`
  );
  return { synced, errors };
}
