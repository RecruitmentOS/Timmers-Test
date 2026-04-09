import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { notificationService } from "../services/notification.service.js";
import { errorResponse } from "../lib/errors.js";

export const notificationRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("notification", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const result = await notificationService.listNotifications(
        orgId,
        user.id
      );
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get(
    "/unread-count",
    requirePermission("notification", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const count = await notificationService.getUnreadCount(
          orgId,
          user.id
        );
        return c.json({ count });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id/read",
    requirePermission("notification", "update"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const { id } = c.req.valid("param");
        await notificationService.markRead(orgId, id, user.id);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/mark-all-read",
    requirePermission("notification", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        await notificationService.markAllRead(orgId, user.id);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
