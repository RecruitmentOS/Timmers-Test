import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { commentService } from "../services/comment.service.js";
import { errorResponse } from "../lib/errors.js";

const createSchema = z.object({
  targetType: z.enum(["application", "vacancy", "candidate"]),
  targetId: z.string().uuid(),
  body: z.string().min(1).max(10000),
  mentions: z.array(z.string()).optional(),
  kind: z.enum(["comment", "hm_feedback"]).optional(),
  feedbackThumb: z.enum(["up", "down"]).optional(),
  isInternal: z.boolean().optional(),
});

const updateSchema = z.object({
  body: z.string().min(1).max(10000),
  mentions: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  targetType: z.enum(["application", "vacancy", "candidate"]),
  targetId: z.string().uuid(),
  includeInternal: z.enum(["true", "false"]).optional(),
});

export const commentRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission("comment", "read"),
    zValidator("query", listQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const q = c.req.valid("query");
        const result = await commentService.listComments(
          orgId,
          q.targetType,
          q.targetId,
          { includeInternal: q.includeInternal !== "false" }
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/",
    requirePermission("comment", "create"),
    zValidator("json", createSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const result = await commentService.createComment(
          orgId,
          c.req.valid("json"),
          user.id
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id",
    requirePermission("comment", "update"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", updateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const { id } = c.req.valid("param");
        const result = await commentService.updateComment(
          orgId,
          id,
          c.req.valid("json"),
          user.id
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/:id",
    requirePermission("comment", "delete"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const { id } = c.req.valid("param");
        await commentService.deleteComment(orgId, id, user.id);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
