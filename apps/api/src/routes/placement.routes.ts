import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { placementService } from "../services/placement.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";

const createPlacementSchema = z.object({
  applicationId: z.string().uuid(),
  agreedRate: z.number().positive().optional(),
  inlenersbeloning: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

const updatePlacementSchema = z.object({
  agreedRate: z.number().positive().nullable().optional(),
  inlenersbeloning: z.boolean().optional(),
  startDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const placementRoutes = new Hono<AppEnv>()
  .post(
    "/",
    requirePermission("application", "update"),
    zValidator("json", createPlacementSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const data = c.req.valid("json");
        const result = await placementService.create(orgId, user.id, data);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/application/:applicationId",
    requirePermission("application", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const applicationId = c.req.param("applicationId");
        const result = await placementService.getByApplication(orgId, applicationId);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id",
    requirePermission("application", "update"),
    zValidator("json", updatePlacementSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const data = c.req.valid("json");
        const result = await placementService.update(orgId, id, data);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/vacancy/:vacancyId",
    requirePermission("vacancy", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("vacancyId");
        const result = await placementService.listByVacancy(orgId, vacancyId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/client/:clientId",
    requirePermission("client", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const clientId = c.req.param("clientId");
        const result = await placementService.listByClient(orgId, clientId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
