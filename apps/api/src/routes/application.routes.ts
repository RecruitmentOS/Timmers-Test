import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { applicationService } from "../services/application.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";

const createApplicationSchema = z.object({
  candidateId: z.string().uuid(),
  vacancyId: z.string().uuid(),
  sourceDetail: z.string().optional(),
});

const moveStageSchema = z.object({
  stageId: z.string().uuid(),
});

const assignAgentSchema = z.object({
  agentUserId: z.string().min(1),
});

const sentToClientSchema = z.object({
  sent: z.boolean(),
});

const sentToHiringManagerSchema = z.object({
  sent: z.boolean(),
});

/**
 * Full qualification verdict schema — writes to reject_reason +
 * qualification_notes columns and optionally advances the stage.
 * Replaces the Phase 1 slim schema (status + rejectReason only).
 */
const qualificationSchema = z.object({
  status: z.enum(["yes", "maybe", "no"]),
  rejectReason: z.string().max(500).optional(),
  qualificationNotes: z.string().max(2000).optional(),
  advanceStage: z.boolean().optional().default(false),
});

/**
 * Bulk action body — SINGLE POST /api/applications/bulk endpoint
 * with discriminated union on `action`. This is a locked 02-CONTEXT
 * decision (D-06..13). Do not split into four routes.
 *
 * Nested `payload` shape mirrors BulkAction in @recruitment-os/types
 * exactly — the frontend sends these on the wire.
 */
export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    applicationIds: z.array(z.string().uuid()).min(1).max(500),
    payload: z.object({ stageId: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("reject"),
    applicationIds: z.array(z.string().uuid()).min(1).max(500),
    payload: z.object({
      rejectReason: z.string().min(1).max(500),
      rejectStageId: z.string().uuid().optional(),
    }),
  }),
  z.object({
    action: z.literal("assign"),
    applicationIds: z.array(z.string().uuid()).min(1).max(500),
    payload: z.object({
      ownerId: z.string().optional(),
      agentUserId: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("tag"),
    applicationIds: z.array(z.string().uuid()).min(1).max(500),
    payload: z.object({ tag: z.string().min(1).max(50) }),
  }),
]);

const bulkByFilterSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    filter: z.object({
      stageId: z.string().uuid().optional(),
      source: z.string().optional(),
      vacancyId: z.string().uuid().optional(),
      ownerId: z.string().optional(),
      qualificationStatus: z
        .enum(["pending", "yes", "maybe", "no"])
        .optional(),
    }),
    payload: z.object({ stageId: z.string().uuid() }),
  }),
  z.object({
    action: z.literal("reject"),
    filter: z.object({
      stageId: z.string().uuid().optional(),
      source: z.string().optional(),
      vacancyId: z.string().uuid().optional(),
      ownerId: z.string().optional(),
      qualificationStatus: z
        .enum(["pending", "yes", "maybe", "no"])
        .optional(),
    }),
    payload: z.object({
      rejectReason: z.string().min(1).max(500),
      rejectStageId: z.string().uuid().optional(),
    }),
  }),
  z.object({
    action: z.literal("assign"),
    filter: z.object({
      stageId: z.string().uuid().optional(),
      source: z.string().optional(),
      vacancyId: z.string().uuid().optional(),
      ownerId: z.string().optional(),
      qualificationStatus: z
        .enum(["pending", "yes", "maybe", "no"])
        .optional(),
    }),
    payload: z.object({
      ownerId: z.string().optional(),
      agentUserId: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("tag"),
    filter: z.object({
      stageId: z.string().uuid().optional(),
      source: z.string().optional(),
      vacancyId: z.string().uuid().optional(),
      ownerId: z.string().optional(),
      qualificationStatus: z
        .enum(["pending", "yes", "maybe", "no"])
        .optional(),
    }),
    payload: z.object({ tag: z.string().min(1).max(50) }),
  }),
]);

/**
 * Paginated list query schema. Returns CandidateApplicationListResponse.
 * Used by the candidate list page and the SelectAllMatchingBanner
 * which reads `total` to show "Select all N matching the filter".
 */
const listApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  stageId: z.string().uuid().optional(),
  source: z.string().optional(),
  vacancyId: z.string().uuid().optional(),
  ownerId: z.string().optional(),
  qualificationStatus: z.enum(["pending", "yes", "maybe", "no"]).optional(),
});

export const applicationRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission("application", "read"),
    zValidator("query", listApplicationsQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const q = c.req.valid("query");
        const result = await applicationService.listPaginated(orgId, q);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/",
    requirePermission("application", "create"),
    zValidator("json", createApplicationSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const data = c.req.valid("json");
        const result = await applicationService.create(orgId, user.id, data);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/bulk",
    requirePermission("bulk", "execute"),
    zValidator("json", bulkActionSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const body = c.req.valid("json");
        const result = await applicationService.bulkUpdate(
          orgId,
          user.id,
          body
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/bulk-by-filter",
    requirePermission("bulk", "execute"),
    zValidator("json", bulkByFilterSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const body = c.req.valid("json");
        const result = await applicationService.bulkByFilter(
          orgId,
          user.id,
          body
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id", requirePermission("application", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await applicationService.getById(orgId, id);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .patch(
    "/:id/stage",
    requirePermission("application", "move"),
    zValidator("json", moveStageSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const user = c.get("user")!;
        const { stageId } = c.req.valid("json");
        const result = await applicationService.moveStage(
          orgId,
          id,
          stageId,
          user.id
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id/agent",
    requirePermission("application", "update"),
    zValidator("json", assignAgentSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { agentUserId } = c.req.valid("json");
        const result = await applicationService.assignAgent(
          orgId,
          id,
          agentUserId
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id/sent-to-client",
    requirePermission("application", "update"),
    zValidator("json", sentToClientSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { sent } = c.req.valid("json");
        const result = await applicationService.markSentToClient(
          orgId,
          id,
          sent
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id/sent-to-hiring-manager",
    requirePermission("application", "update"),
    zValidator("json", sentToHiringManagerSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { sent } = c.req.valid("json");
        const result = await applicationService.markSentToHiringManager(
          orgId,
          id,
          sent
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/:id/qualification",
    requirePermission("application", "update"),
    zValidator("json", qualificationSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const id = c.req.param("id");
        const body = c.req.valid("json");
        const result = await applicationService.qualify(
          orgId,
          user.id,
          id,
          body
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id/history", requirePermission("application", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await applicationService.getStageHistory(orgId, id);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
