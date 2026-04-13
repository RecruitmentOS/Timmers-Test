import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { linkedinService } from "../services/linkedin.service.js";

const webhookPayloadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  jobId: z.string().min(1),
});

export const linkedinRoutes = new Hono<AppEnv>()
  /**
   * POST /post-vacancy — Dormant stub (always 503)
   */
  .post("/post-vacancy", async (c) => {
    const orgId = c.get("organizationId");
    const body = await c.req.json().catch(() => ({}));
    const result = linkedinService.postVacancy(orgId, body?.vacancyId ?? "");
    return c.json(result, 503);
  })

  /**
   * POST /sync — Dormant stub (always 503)
   */
  .post("/sync", async (c) => {
    const orgId = c.get("organizationId");
    const result = linkedinService.syncApplies(orgId);
    return c.json(result, 503);
  })

  /**
   * GET /status — Returns availability status
   */
  .get("/status", async (c) => {
    return c.json({
      available: linkedinService.isAvailable(),
      message: "Vereist LinkedIn-partnerschap",
    });
  })

  /**
   * POST /webhook — LinkedIn Apply Connect webhook receiver.
   * Validates LINKEDIN_WEBHOOK_SECRET header. Feature-flagged.
   */
  .post("/webhook", zValidator("json", webhookPayloadSchema), async (c) => {
    const secret = process.env.LINKEDIN_WEBHOOK_SECRET;
    if (!secret) {
      return c.json({ error: "LinkedIn webhook not configured" }, 503);
    }

    const headerSecret = c.req.header("x-linkedin-webhook-secret");
    if (headerSecret !== secret) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const payload = c.req.valid("json");
    const result = await linkedinService.processWebhook(payload);
    return c.json(result, 503);
  });
