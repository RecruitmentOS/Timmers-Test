import { eq } from "drizzle-orm";
import { getMetaConnection } from "./meta-connection.service.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { campaigns } from "../db/schema/index.js";
import type { TargetingSpec } from "@recruitment-os/types";

// ============================================================
// Meta Marketing API wrapper — Campaign > AdSet > Ad creation
// Uses facebook-nodejs-business-sdk for Meta API interactions
// Feature-flagged: requires both META_ENCRYPTION_KEY and org connection
// ============================================================

/**
 * Parameters for creating a Meta job ad.
 */
export interface MetaJobAdParams {
  campaignId: string; // local campaign ID
  name: string;
  vacancyTitle: string;
  vacancyDescription: string;
  applyUrl: string;
  dailyBudgetCents: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  targeting: TargetingSpec;
}

/**
 * Create a full Meta job ad: Campaign > AdSet > Ad Creative > Ad.
 * Updates local campaign record with Meta IDs.
 *
 * IMPORTANT: Always sets special_ad_categories: ["EMPLOYMENT"] per Meta policy.
 */
export async function createMetaJobAd(
  orgId: string,
  params: MetaJobAdParams
): Promise<{ metaCampaignId: string; metaAdsetId: string; adId: string }> {
  const connection = await getMetaConnection(orgId);
  if (!connection) {
    throw new Error("Meta connection not configured for this organization");
  }

  try {
    // Dynamic import to avoid loading SDK when Meta is not configured
    const { FacebookAdsApi, AdAccount } = await import(
      "facebook-nodejs-business-sdk"
    );

    // Initialize SDK with decrypted access token
    FacebookAdsApi.init(connection.accessToken);
    const account = new AdAccount(`act_${connection.metaAdAccountId}`);

    // Generate UTM params for tracking
    const utmParams = new URLSearchParams({
      utm_source: "meta",
      utm_medium: "paid",
      utm_campaign: params.campaignId,
    });
    const applyUrlWithUtm = `${params.applyUrl}${params.applyUrl.includes("?") ? "&" : "?"}${utmParams.toString()}`;

    // 1. Create Campaign — ALWAYS set EMPLOYMENT special ad category
    const campaignResult = await account.createCampaign([], {
      name: params.name,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: ["EMPLOYMENT"],
    });
    const metaCampaignId = campaignResult.id;

    // 2. Create Ad Set with targeting and budget
    const adSetResult = await account.createAdSet([], {
      name: `${params.name} - Ad Set`,
      campaign_id: metaCampaignId,
      daily_budget: params.dailyBudgetCents, // Meta API accepts cents
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      start_time: params.startDate,
      end_time: params.endDate,
      targeting: {
        geo_locations: params.targeting.geoLocations,
        locales: params.targeting.locales,
        interests: params.targeting.interests,
      },
      status: "PAUSED",
    });
    const metaAdsetId = adSetResult.id;

    // 3. Create Ad Creative with vacancy info
    const creativeResult = await account.createAdCreative([], {
      name: `${params.name} - Creative`,
      object_story_spec: {
        link_data: {
          link: applyUrlWithUtm,
          message: params.vacancyDescription,
          name: params.vacancyTitle,
          call_to_action: {
            type: "APPLY_NOW",
            value: { link: applyUrlWithUtm },
          },
        },
      },
    });
    const creativeId = creativeResult.id;

    // 4. Create Ad linking creative to ad set
    const adResult = await account.createAd([], {
      name: `${params.name} - Ad`,
      adset_id: metaAdsetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
    });
    const adId = adResult.id;

    // 5. Update local campaign record with Meta IDs
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(campaigns)
        .set({
          metaCampaignId,
          metaAdsetId,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, params.campaignId));
    });

    console.log(
      `[Meta] Created job ad for campaign ${params.campaignId}: campaign=${metaCampaignId}, adset=${metaAdsetId}, ad=${adId}`
    );

    return { metaCampaignId, metaAdsetId, adId };
  } catch (error: any) {
    // Meta SDK throws specific error objects with codes
    const metaError = error?.response?.error || error;
    console.error(
      `[Meta] Failed to create job ad for campaign ${params.campaignId}:`,
      {
        message: metaError?.message || error.message,
        code: metaError?.code,
        type: metaError?.type,
        fbtrace_id: metaError?.fbtrace_id,
      }
    );
    throw new Error(
      `Meta API error: ${metaError?.message || error.message}`
    );
  }
}

/**
 * Pause a Meta campaign.
 */
export async function pauseMetaCampaign(
  orgId: string,
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
    await campaign.update([], { status: "PAUSED" });
    console.log(`[Meta] Paused campaign ${metaCampaignId}`);
  } catch (error: any) {
    console.error(`[Meta] Failed to pause campaign ${metaCampaignId}:`, error.message);
    throw new Error(`Meta API error: ${error.message}`);
  }
}

/**
 * Resume (activate) a Meta campaign.
 */
export async function resumeMetaCampaign(
  orgId: string,
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
    await campaign.update([], { status: "ACTIVE" });
    console.log(`[Meta] Resumed campaign ${metaCampaignId}`);
  } catch (error: any) {
    console.error(`[Meta] Failed to resume campaign ${metaCampaignId}:`, error.message);
    throw new Error(`Meta API error: ${error.message}`);
  }
}

/**
 * Get current status of a Meta campaign.
 */
export async function getMetaCampaignStatus(
  orgId: string,
  metaCampaignId: string
): Promise<{ status: string; effectiveStatus: string } | null> {
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
    const result = await campaign.read(["status", "effective_status"]);
    return {
      status: result.status,
      effectiveStatus: result.effective_status,
    };
  } catch (error: any) {
    console.error(
      `[Meta] Failed to get status for campaign ${metaCampaignId}:`,
      error.message
    );
    throw new Error(`Meta API error: ${error.message}`);
  }
}
