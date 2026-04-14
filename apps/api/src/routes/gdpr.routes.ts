import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { gdprService } from "../services/gdpr.service.js";
import { errorResponse } from "../lib/errors.js";

const notificationPrefsSchema = z.object({
  emailMentions: z.boolean().optional(),
  emailAssignments: z.boolean().optional(),
  emailTaskReminders: z.boolean().optional(),
  emailDocumentExpiry: z.boolean().optional(),
});

export const gdprRoutes = new Hono<AppEnv>()
  /**
   * GET /api/gdpr/export — Download all personal data as JSON (GDPR-02).
   */
  .get("/export", async (c) => {
    try {
      const userId = c.get("user")!.id;
      const orgId = c.get("organizationId");
      const data = await gdprService.exportUserData(userId, orgId);

      c.header(
        "Content-Disposition",
        `attachment; filename="data-export-${userId}.json"`
      );
      c.header("Content-Type", "application/json");
      return c.json(data);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /api/gdpr/notification-preferences — Get current notification preferences (GDPR-03).
   */
  .get("/notification-preferences", async (c) => {
    try {
      const userId = c.get("user")!.id;
      const prefs = await gdprService.getNotificationPreferences(userId);
      return c.json(prefs);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * PUT /api/gdpr/notification-preferences — Update notification preferences (GDPR-03).
   */
  .put(
    "/notification-preferences",
    zValidator("json", notificationPrefsSchema),
    async (c) => {
      try {
        const userId = c.get("user")!.id;
        const body = c.req.valid("json");
        const prefs = await gdprService.updateNotificationPreferences(
          userId,
          body
        );
        return c.json(prefs);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
