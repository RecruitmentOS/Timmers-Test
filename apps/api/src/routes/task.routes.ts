import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { taskService } from "../services/task.service.js";
import { errorResponse } from "../lib/errors.js";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  candidateId: z.string().uuid().optional(),
  vacancyId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  assignedToUserId: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  assignedToUserId: z.string().min(1).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["open", "completed"]).optional(),
});

const listQuerySchema = z.object({
  assignedTo: z.string().optional(),
  status: z.enum(["open", "completed"]).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  vacancyId: z.string().uuid().optional(),
});

export const taskRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission("task", "read"),
    zValidator("query", listQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const q = c.req.valid("query");
        const result = await taskService.list(orgId, {
          assignedTo: q.assignedTo,
          status: q.status,
          dueBefore: q.dueBefore ? new Date(q.dueBefore) : undefined,
          dueAfter: q.dueAfter ? new Date(q.dueAfter) : undefined,
          vacancyId: q.vacancyId,
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/",
    requirePermission("task", "create"),
    zValidator("json", createSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const result = await taskService.create(
          orgId,
          user.id,
          c.req.valid("json")
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/:id",
    requirePermission("task", "read"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { id } = c.req.valid("param");
        const result = await taskService.getById(orgId, id);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id",
    requirePermission("task", "update"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    zValidator("json", updateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const { id } = c.req.valid("param");
        const result = await taskService.update(
          orgId,
          user.id,
          id,
          c.req.valid("json")
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/:id/complete",
    requirePermission("task", "update"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const { id } = c.req.valid("param");
        const result = await taskService.complete(orgId, user.id, id);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/:id",
    requirePermission("task", "delete"),
    zValidator("param", z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { id } = c.req.valid("param");
        await taskService.delete(orgId, id);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
