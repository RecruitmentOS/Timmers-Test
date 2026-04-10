import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { adminService } from "../services/admin.service.js";
import { errorResponse } from "../lib/errors.js";

// ==========================================
// Zod schemas
// ==========================================

const updateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z.string().optional().nullable(),
  metadata: z.string().optional().nullable(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
});

const updateRoleSchema = z.object({
  role: z.string().min(1),
});

const createStageSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateStageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const reorderStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()),
});

const createPresetSchema = z.object({
  name: z.string().min(1).max(100),
  criteria: z.string().min(1),
  isDefault: z.boolean().optional().default(false),
});

const updatePresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  criteria: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// ==========================================
// Routes
// ==========================================

export const adminRoutes = new Hono<AppEnv>()

  // ---- Organization settings ----
  .get("/settings", requirePermission("settings", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const result = await adminService.getOrgSettings(orgId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .patch(
    "/settings",
    requirePermission("settings", "update"),
    zValidator("json", updateSettingsSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const data = c.req.valid("json");
        const result = await adminService.updateOrgSettings(orgId, data);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  // ---- Team members ----
  .get("/team", requirePermission("settings", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const result = await adminService.getTeamMembers(orgId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/team/invite",
    requirePermission("settings", "update"),
    zValidator("json", inviteMemberSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { email, role } = c.req.valid("json");
        const user = c.get("user") as any;
        const result = await adminService.inviteMember(orgId, email, role, user.id);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/team/:memberId/role",
    requirePermission("settings", "update"),
    zValidator("json", updateRoleSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const memberId = c.req.param("memberId");
        const { role } = c.req.valid("json");
        const result = await adminService.updateMemberRole(orgId, memberId, role);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/team/:memberId",
    requirePermission("settings", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const memberId = c.req.param("memberId");
        await adminService.removeMember(orgId, memberId);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  // ---- Pipeline stages ----
  .get(
    "/pipeline-stages",
    requirePermission("settings", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const result = await adminService.getPipelineStages(orgId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/pipeline-stages",
    requirePermission("settings", "update"),
    zValidator("json", createStageSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { name } = c.req.valid("json");
        const result = await adminService.createPipelineStage(orgId, name);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/pipeline-stages/:stageId",
    requirePermission("settings", "update"),
    zValidator("json", updateStageSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const stageId = c.req.param("stageId");
        const data = c.req.valid("json");
        const result = await adminService.updatePipelineStage(orgId, stageId, data);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/pipeline-stages/reorder",
    requirePermission("settings", "update"),
    zValidator("json", reorderStagesSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { stageIds } = c.req.valid("json");
        await adminService.reorderPipelineStages(orgId, stageIds);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/pipeline-stages/:stageId",
    requirePermission("settings", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const stageId = c.req.param("stageId");
        await adminService.deletePipelineStage(orgId, stageId);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  // ---- Qualification presets ----
  .get(
    "/qualification-presets",
    requirePermission("settings", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const result = await adminService.getQualificationPresets(orgId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/qualification-presets",
    requirePermission("settings", "update"),
    zValidator("json", createPresetSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { name, criteria, isDefault } = c.req.valid("json");
        const result = await adminService.createQualificationPreset(
          orgId,
          name,
          criteria,
          isDefault
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .patch(
    "/qualification-presets/:presetId",
    requirePermission("settings", "update"),
    zValidator("json", updatePresetSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const presetId = c.req.param("presetId");
        const data = c.req.valid("json");
        const result = await adminService.updateQualificationPreset(
          orgId,
          presetId,
          data
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/qualification-presets/:presetId",
    requirePermission("settings", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const presetId = c.req.param("presetId");
        await adminService.deleteQualificationPreset(orgId, presetId);
        return c.json({ ok: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
