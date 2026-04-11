import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";
import {
  createPersonaTemplate,
  getPersonaTemplates,
  getPersonaTemplateById,
  updatePersonaTemplate,
  deletePersonaTemplate,
  createPersonaTemplateSchema,
} from "../services/persona-template.service.js";

export const personaTemplateRoutes = new Hono<AppEnv>()
  // POST /api/persona-templates -- create
  .post(
    "/",
    requirePermission("campaign", "create"),
    zValidator("json", createPersonaTemplateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const input = c.req.valid("json");
        const template = await createPersonaTemplate(orgId, user.id, input);
        return c.json(template, 201);
      } catch (error) {
        return errorResponse(c, error as Error);
      }
    }
  )
  // GET /api/persona-templates -- list, optional vacancyId filter
  .get("/", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const vacancyId = c.req.query("vacancyId");
      const templates = await getPersonaTemplates(orgId, {
        vacancyId: vacancyId || undefined,
      });
      return c.json(templates);
    } catch (error) {
      return errorResponse(c, error as Error);
    }
  })
  // GET /api/persona-templates/:id -- get by ID with joined targeting template
  .get("/:id", requirePermission("campaign", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const template = await getPersonaTemplateById(orgId, id);
      if (!template) {
        return c.json({ error: "Persona template not found" }, 404);
      }
      return c.json(template);
    } catch (error) {
      return errorResponse(c, error as Error);
    }
  })
  // PATCH /api/persona-templates/:id -- update
  .patch(
    "/:id",
    requirePermission("campaign", "update"),
    zValidator("json", createPersonaTemplateSchema.partial()),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const input = c.req.valid("json");
        const template = await updatePersonaTemplate(orgId, id, input);
        if (!template) {
          return c.json({ error: "Persona template not found" }, 404);
        }
        return c.json(template);
      } catch (error) {
        return errorResponse(c, error as Error);
      }
    }
  )
  // DELETE /api/persona-templates/:id -- delete
  .delete("/:id", requirePermission("campaign", "delete"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await deletePersonaTemplate(orgId, id);
      return c.json({ success: true });
    } catch (error) {
      return errorResponse(c, error as Error);
    }
  });
