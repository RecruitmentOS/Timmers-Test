import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { aiScreeningService } from "../services/ai-screening.service.js";
import { errorResponse } from "../lib/errors.js";

const triggerSchema = z.object({
  applicationId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const aiScreeningRoutes = new Hono<AppEnv>()
  /**
   * POST /trigger — Trigger AI screening for an application.
   */
  .post("/trigger", zValidator("json", triggerSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { applicationId, force } = c.req.valid("json");
      const result = await aiScreeningService.triggerScreening(
        orgId,
        applicationId,
        force ?? false
      );
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /:logId — Get a single screening result.
   */
  .get("/:logId", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const logId = c.req.param("logId");

      // Skip if logId looks like a sub-route name
      if (["usage", "history"].includes(logId)) {
        return c.notFound();
      }

      const result = await aiScreeningService.getScreeningResult(orgId, logId);
      if (!result) {
        return c.json({ error: "Screening log not found" }, 404);
      }
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /history/:applicationId — Get screening history for an application.
   */
  .get("/history/:applicationId", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const applicationId = c.req.param("applicationId");
      const history = await aiScreeningService.getScreeningHistory(
        orgId,
        applicationId
      );
      return c.json(history);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /usage — Get current month AI usage stats.
   */
  .get("/usage", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const usage = await aiScreeningService.getUsage(orgId);
      return c.json(usage);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
