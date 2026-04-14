import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { candidateService } from "../services/candidate.service.js";
import { applicationService } from "../services/application.service.js";
import { fileService } from "../services/file.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";

const createCandidateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  availabilityType: z.enum(["direct", "opzegtermijn", "in_overleg"]).optional(),
  availabilityStartDate: z.string().datetime().optional(),
  contractType: z.enum(["vast", "tijdelijk", "uitzend", "zzp"]).optional(),
});

const updateCandidateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  availabilityType: z.enum(["direct", "opzegtermijn", "in_overleg"]).nullable().optional(),
  availabilityStartDate: z.string().datetime().nullable().optional(),
  contractType: z.enum(["vast", "tijdelijk", "uitzend", "zzp"]).nullable().optional(),
});

export const candidateRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("candidate", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { search, source, vacancyId, stage, ownerId, qualificationStatus } =
        c.req.query();
      const result = await candidateService.list(orgId, {
        search,
        source,
        vacancyId,
        stage,
        ownerId,
        qualificationStatus,
      });
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/",
    requirePermission("candidate", "create"),
    zValidator("json", createCandidateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const data = c.req.valid("json");
        const result = await candidateService.create(orgId, user.id, data);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id", requirePermission("candidate", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await candidateService.getById(orgId, id);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .patch(
    "/:id",
    requirePermission("candidate", "update"),
    zValidator("json", updateCandidateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const data = c.req.valid("json");
        const result = await candidateService.update(orgId, id, data);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete("/:id", requirePermission("candidate", "delete"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await candidateService.delete(orgId, id);
      return c.json({ success: true });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get(
    "/:id/applications",
    requirePermission("candidate", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const candidateId = c.req.param("id");
        const result = await applicationService.listByCandidate(
          orgId,
          candidateId
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/:id/timeline",
    requirePermission("candidate", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const candidateId = c.req.param("id");
        const result = await candidateService.getActivityTimeline(
          orgId,
          candidateId
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id/files", requirePermission("candidate", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const candidateId = c.req.param("id");
      const result = await fileService.listFiles(orgId, "candidate", candidateId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
