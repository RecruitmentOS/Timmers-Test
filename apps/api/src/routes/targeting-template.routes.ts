import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";
import {
  createTargetingTemplate,
  getTargetingTemplates,
  getTargetingTemplateById,
  updateTargetingTemplate,
  deleteTargetingTemplate,
  createTargetingTemplateSchema,
} from "../services/targeting-template.service.js";

export const targetingTemplateRoutes = new Hono<AppEnv>()
  // POST /api/targeting-templates -- create
  .post(
    "/",
    requirePermission("campaign", "create"),
    zValidator("json", createTargetingTemplateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const input = c.req.valid("json");
        const template = await createTargetingTemplate(orgId, user.id, input);
        return c.json(template, 201);
      } catch (error) {
        return errorResponse(c, error as Error);
      }
    }
  )
  // GET /api/targeting-templates -- list all for org
  .get("/", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const templates = await getTargetingTemplates(orgId);
      return c.json(templates);
    } catch (error) {
      return errorResponse(c, error as Error);
    }
  })
  // GET /api/targeting-templates/:id -- get by ID
  .get("/:id", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const template = await getTargetingTemplateById(orgId, id);
      if (!template) {
        return c.json({ error: "Targeting template not found" }, 404);
      }
      return c.json(template);
    } catch (error) {
      return errorResponse(c, error as Error);
    }
  })
  // PATCH /api/targeting-templates/:id -- update
  .patch(
    "/:id",
    requirePermission("campaign", "update"),
    zValidator("json", createTargetingTemplateSchema.partial()),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const input = c.req.valid("json");
        const template = await updateTargetingTemplate(orgId, id, input);
        if (!template) {
          return c.json({ error: "Targeting template not found" }, 404);
        }
        return c.json(template);
      } catch (error) {
        return errorResponse(c, error as Error);
      }
    }
  )
  // DELETE /api/targeting-templates/:id -- delete
  .delete("/:id", requirePermission("campaign", "delete"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await deleteTargetingTemplate(orgId, id);
      return c.json({ success: true });
    } catch (error) {
      return errorResponse(c, error as Error);
    }
  });
