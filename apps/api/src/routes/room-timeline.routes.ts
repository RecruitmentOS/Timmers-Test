import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { roomTimelineService } from "../services/room-timeline.service.js";
import { errorResponse } from "../lib/errors.js";

const timelineQuerySchema = z.object({
  vacancyId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  includeInternal: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export const roomTimelineRoutes = new Hono<AppEnv>().get(
  "/",
  requirePermission("activity", "read"),
  zValidator("query", timelineQuerySchema),
  async (c) => {
    try {
      const orgId = c.get("organizationId");
      const q = c.req.valid("query");
      const result = await roomTimelineService.getTimeline(orgId, q.vacancyId, {
        limit: q.limit,
        cursor: q.cursor,
        includeInternal: q.includeInternal,
      });
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  }
);
