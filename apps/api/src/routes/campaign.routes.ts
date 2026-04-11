import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import {
  campaignService,
  createCampaignSchema,
  updateCampaignSchema,
} from "../services/campaign.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";
import { z } from "zod";

export const campaignRoutes = new Hono<AppEnv>()
  // POST /api/campaigns -- create campaign
  .post(
    "/",
    requirePermission("campaign", "create"),
    zValidator("json", createCampaignSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const data = c.req.valid("json");
        const result = await campaignService.createCampaign(
          orgId,
          user.id,
          data
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  // GET /api/campaigns -- list campaigns with filters
  .get("/", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { vacancyId, status, channel, withMetrics } = c.req.query();

      if (withMetrics === "true") {
        const result = await campaignService.getCampaignsWithMetrics(
          orgId,
          vacancyId
        );
        return c.json(result);
      }

      const result = await campaignService.getCampaigns(orgId, {
        vacancyId,
        status,
        channel,
      });
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // GET /api/campaigns/:id -- single campaign with vacancy info
  .get("/:id", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await campaignService.getCampaignById(orgId, id);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // GET /api/campaigns/:id/metrics -- attribution dashboard metrics
  .get("/:id/metrics", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await campaignService.getCampaignMetrics(orgId, id);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // GET /api/campaigns/:id/applications -- linked applications drill-down
  .get(
    "/:id/applications",
    requirePermission("campaign", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { page, limit } = c.req.query();
        const result = await campaignService.getCampaignApplications(orgId, id, {
          page: page ? parseInt(page, 10) : undefined,
          limit: limit ? parseInt(limit, 10) : undefined,
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  // PATCH /api/campaigns/:id -- update campaign (incl. manual spend)
  .patch(
    "/:id",
    requirePermission("campaign", "update"),
    zValidator("json", updateCampaignSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const data = c.req.valid("json");
        const result = await campaignService.updateCampaign(orgId, id, data);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  // DELETE /api/campaigns/:id -- delete campaign
  .delete("/:id", requirePermission("campaign", "delete"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await campaignService.deleteCampaign(orgId, id);
      return c.json({ success: true });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
