import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { pipelineService } from "../services/pipeline.service.js";
import { errorResponse } from "../lib/errors.js";

export const pipelineRoutes = new Hono<AppEnv>().get(
  "/:vacancyId",
  requirePermission("vacancy", "read"),
  zValidator("param", z.object({ vacancyId: z.string().uuid() })),
  async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { vacancyId } = c.req.valid("param");
      const board = await pipelineService.getBoard(orgId, vacancyId);
      return c.json(board);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  }
);
