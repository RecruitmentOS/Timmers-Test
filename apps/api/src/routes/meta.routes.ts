import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";
import {
  saveMetaConnection,
  getMetaConnection,
  deleteMetaConnection,
  isMetaConfigured,
  isMetaSystemConfigured,
} from "../services/meta-connection.service.js";
import {
  createMetaJobAd,
  type MetaJobAdParams,
} from "../services/meta-ads.service.js";
import { syncCampaignInsights } from "../services/meta-insights.service.js";
import { campaignService } from "../services/campaign.service.js";

// ============================================================
// Meta routes — admin connection management + campaign launch
// ============================================================

const connectSchema = z.object({
  metaAdAccountId: z.string().min(1),
  accessToken: z.string().min(1),
});

export const metaRoutes = new Hono<AppEnv>()

  // POST /api/meta/connect — save Meta credentials
  .post(
    "/connect",
    requirePermission("settings", "update"),
    zValidator("json", connectSchema),
    async (c) => {
      try {
        if (!isMetaSystemConfigured()) {
          return c.json(
            { error: "Meta integration not configured on this server" },
            503
          );
        }

        const orgId = c.get("organizationId");
        const { metaAdAccountId, accessToken } = c.req.valid("json");

        // Validate token by making a test API call
        try {
          const { FacebookAdsApi, AdAccount } = await import(
            "facebook-nodejs-business-sdk"
          );
          FacebookAdsApi.init(accessToken);
          const account = new AdAccount(`act_${metaAdAccountId}`);
          await account.read(["name", "account_id"]);
        } catch (validateErr: any) {
          return c.json(
            {
              error: "Invalid Meta credentials",
              details: validateErr.message,
            },
            400
          );
        }

        await saveMetaConnection(orgId, metaAdAccountId, accessToken);

        return c.json({ success: true, message: "Meta account connected" });
      } catch (error: any) {
        return errorResponse(c, error);
      }
    }
  )

  // GET /api/meta/status — check connection status
  .get("/status", requirePermission("settings", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");

      if (!isMetaSystemConfigured()) {
        return c.json({
          systemConfigured: false,
          connected: false,
          adAccountId: null,
          tokenExpiresAt: null,
          expiryWarning: null,
        });
      }

      const connection = await getMetaConnection(orgId);

      if (!connection) {
        return c.json({
          systemConfigured: true,
          connected: false,
          adAccountId: null,
          tokenExpiresAt: null,
          expiryWarning: null,
        });
      }

      // Check if token is expiring soon (within 7 days)
      let expiryWarning: string | null = null;
      if (connection.tokenExpiresAt) {
        const daysUntilExpiry = Math.floor(
          (connection.tokenExpiresAt.getTime() - Date.now()) / 86_400_000
        );
        if (daysUntilExpiry <= 0) {
          expiryWarning = "Token has expired. Please reconnect.";
        } else if (daysUntilExpiry <= 7) {
          expiryWarning = `Token expires in ${daysUntilExpiry} day(s). Consider refreshing.`;
        }
      }

      return c.json({
        systemConfigured: true,
        connected: true,
        adAccountId: connection.metaAdAccountId,
        tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
        expiryWarning,
      });
    } catch (error: any) {
      return errorResponse(c, error);
    }
  })

  // DELETE /api/meta/disconnect — remove Meta credentials
  .delete(
    "/disconnect",
    requirePermission("settings", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        await deleteMetaConnection(orgId);
        return c.json({ success: true, message: "Meta account disconnected" });
      } catch (error: any) {
        return errorResponse(c, error);
      }
    }
  )

  // POST /api/meta/sync/:campaignId — manually trigger Insights sync
  .post(
    "/sync/:campaignId",
    requirePermission("campaign", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const campaignId = c.req.param("campaignId");

        // Get campaign to find Meta campaign ID
        const campaign = await campaignService.getCampaignById(
          orgId,
          campaignId
        );
        if (!campaign) {
          return c.json({ error: "Campaign not found" }, 404);
        }
        if (!campaign.metaCampaignId) {
          return c.json(
            { error: "Campaign has no Meta campaign linked" },
            400
          );
        }

        await syncCampaignInsights(orgId, campaignId, campaign.metaCampaignId);

        return c.json({ success: true, message: "Insights synced" });
      } catch (error: any) {
        return errorResponse(c, error);
      }
    }
  )

  // POST /api/meta/campaigns/:campaignId/launch — create Meta job ad from campaign
  .post(
    "/campaigns/:campaignId/launch",
    requirePermission("campaign", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const campaignId = c.req.param("campaignId");

        // Fetch campaign with vacancy info
        const campaign = await campaignService.getCampaignById(
          orgId,
          campaignId
        );
        if (!campaign) {
          return c.json({ error: "Campaign not found" }, 404);
        }
        if (campaign.metaCampaignId) {
          return c.json(
            { error: "Campaign already has a Meta ad created" },
            400
          );
        }
        if (campaign.channel !== "meta") {
          return c.json(
            { error: "Campaign channel must be 'meta'" },
            400
          );
        }

        // Build params from campaign data
        // Apply URL uses the tenant subdomain pattern
        const applyUrl = `https://apply.recruitment-os.nl/vacancy/${campaign.vacancyId}`;

        const params: MetaJobAdParams = {
          campaignId: campaign.id,
          name: campaign.name,
          vacancyTitle: campaign.vacancyTitle ?? campaign.name,
          vacancyDescription: `Apply now for ${campaign.vacancyTitle ?? campaign.name}`,
          applyUrl,
          dailyBudgetCents: campaign.budgetCents ?? 2000, // default 20 EUR/day
          startDate: campaign.startDate ?? new Date().toISOString().split("T")[0],
          endDate:
            campaign.endDate ??
            new Date(Date.now() + 30 * 86_400_000)
              .toISOString()
              .split("T")[0],
          targeting: {
            geoLocations: {
              countries: ["NL"],
            },
          },
        };

        const result = await createMetaJobAd(orgId, params);

        return c.json({
          success: true,
          metaCampaignId: result.metaCampaignId,
          metaAdsetId: result.metaAdsetId,
          adId: result.adId,
        });
      } catch (error: any) {
        return errorResponse(c, error);
      }
    }
  );
