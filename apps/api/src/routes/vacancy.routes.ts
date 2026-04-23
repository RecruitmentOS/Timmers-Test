import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { vacancyService } from "../services/vacancy.service.js";
import { applicationService } from "../services/application.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";

const createVacancySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  clientId: z.string().uuid().optional(),
  qualificationCriteria: z.any().optional(),
  hourlyRate: z.number().positive().optional(),
});

const updateVacancySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "closed", "archived"]).optional(),
  clientId: z.string().uuid().nullable().optional(),
  qualificationCriteria: z.any().optional(),
  intakeEnabled: z.boolean().optional(),
  hourlyRate: z.number().positive().nullable().optional(),
  distributionChannels: z.record(z.string(), z.boolean()).optional(),
});

const addAssignmentSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
});

const addNoteSchema = z.object({
  content: z.string().min(1),
});

export const vacancyRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("vacancy", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { status, ownerId, clientId, location, search, includeArchived } = c.req.query();
      const result = await vacancyService.list(orgId, {
        status,
        ownerId,
        clientId,
        location,
        search,
        includeArchived: includeArchived === "true",
      });
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/",
    requirePermission("vacancy", "create"),
    zValidator("json", createVacancySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const data = c.req.valid("json");
        const result = await vacancyService.create(orgId, user.id, data);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id", requirePermission("vacancy", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await vacancyService.getById(orgId, id);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .patch(
    "/:id",
    requirePermission("vacancy", "update"),
    zValidator("json", updateVacancySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const data = c.req.valid("json");
        const result = await vacancyService.update(orgId, id, data);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete("/:id", requirePermission("vacancy", "delete"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await vacancyService.delete(orgId, id);
      return c.json({ success: true });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/:id/assignments",
    requirePermission("vacancy", "update"),
    zValidator("json", addAssignmentSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("id");
        const { userId, role } = c.req.valid("json");
        await vacancyService.addAssignment(orgId, vacancyId, userId, role);
        return c.json({ success: true }, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/:id/assignments/:userId",
    requirePermission("vacancy", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("id");
        const userId = c.req.param("userId");
        await vacancyService.removeAssignment(orgId, vacancyId, userId);
        return c.json({ success: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/:id/assignments",
    requirePermission("vacancy", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("id");
        const result = await vacancyService.getAssignments(orgId, vacancyId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/:id/notes",
    requirePermission("vacancy", "update"),
    zValidator("json", addNoteSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("id");
        const user = c.get("user")!;
        const { content } = c.req.valid("json");
        const result = await vacancyService.addNote(
          orgId,
          vacancyId,
          user.id,
          content
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id/notes", requirePermission("vacancy", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const vacancyId = c.req.param("id");
      const result = await vacancyService.getNotes(orgId, vacancyId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/:id/archive",
    requirePermission("vacancy", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const result = await vacancyService.archive(orgId, id);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/:id/unarchive",
    requirePermission("vacancy", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const result = await vacancyService.unarchive(orgId, id);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/:id/applications",
    requirePermission("vacancy", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("id");
        const result = await applicationService.listByVacancy(orgId, vacancyId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
