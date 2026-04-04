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

const qualificationSchema = z.object({
  status: z.enum(["pending", "yes", "maybe", "no"]),
  rejectReason: z.string().optional(),
});

export const applicationRoutes = new Hono<AppEnv>()
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
    "/:id/qualification",
    requirePermission("application", "update"),
    zValidator("json", qualificationSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { status, rejectReason } = c.req.valid("json");
        const result = await applicationService.updateQualification(
          orgId,
          id,
          status,
          rejectReason
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/:id/history",
    requirePermission("application", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const result = await applicationService.getStageHistory(orgId, id);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
