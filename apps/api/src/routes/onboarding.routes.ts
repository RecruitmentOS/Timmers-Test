import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { onboardingService } from "../services/onboarding.service.js";
import { errorResponse } from "../lib/errors.js";

const onboardingInputSchema = z.object({
  orgName: z.string().min(2).max(100),
  mode: z.enum(["agency", "employer"]),
  primaryLocation: z.string().min(1),
  expectedUserCount: z.number().int().min(1).max(1000),
});

export const onboardingRoutes = new Hono<AppEnv>()
  /**
   * POST /create-org — Create organization through onboarding wizard.
   * Requires authenticated user (auth middleware already applied).
   */
  .post("/create-org", zValidator("json", onboardingInputSchema), async (c) => {
    try {
      const user = c.get("user");
      const session = c.get("session");
      if (!user || !session) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const input = c.req.valid("json");
      const result = await onboardingService.createOrganization(
        user.id,
        user.email,
        session.id,
        input
      );

      return c.json(result, 201);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })
  /**
   * GET /check-slug/:slug — Check slug availability for real-time validation.
   */
  .get("/check-slug/:slug", async (c) => {
    try {
      const slug = c.req.param("slug");
      if (!slug || slug.length < 2) {
        return c.json({ available: false });
      }

      const available = await onboardingService.checkSlugAvailability(slug);
      return c.json({ available });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
