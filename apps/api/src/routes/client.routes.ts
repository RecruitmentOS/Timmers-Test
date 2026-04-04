import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { clientService } from "../services/client.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";

const createClientSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().email().optional(),
  status: z.string().optional(),
});

const vacancyAccessSchema = z.object({
  vacancyId: z.string().uuid(),
});

const assignUserSchema = z.object({
  userId: z.string().min(1),
});

const inviteClientUserSchema = z.object({
  email: z.string().email(),
});

export const clientRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("client", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const result = await clientService.list(orgId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/",
    requirePermission("client", "create"),
    zValidator("json", createClientSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const data = c.req.valid("json");
        const result = await clientService.create(orgId, user.id, data);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id", requirePermission("client", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const result = await clientService.getById(orgId, id);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .patch(
    "/:id",
    requirePermission("client", "update"),
    zValidator("json", updateClientSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const data = c.req.valid("json");
        const result = await clientService.update(orgId, id, data);
        if (!result) return c.json({ error: "Not found" }, 404);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete("/:id", requirePermission("client", "delete"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await clientService.delete(orgId, id);
      return c.json({ success: true });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post(
    "/:id/vacancy-access",
    requirePermission("client", "update"),
    zValidator("json", vacancyAccessSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const clientId = c.req.param("id");
        const { vacancyId } = c.req.valid("json");
        await clientService.addVacancyAccess(orgId, clientId, vacancyId);
        return c.json({ success: true }, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .delete(
    "/:id/vacancy-access/:vacancyId",
    requirePermission("client", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const clientId = c.req.param("id");
        const vacancyId = c.req.param("vacancyId");
        await clientService.removeVacancyAccess(orgId, clientId, vacancyId);
        return c.json({ success: true });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get(
    "/:id/vacancy-access",
    requirePermission("client", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const clientId = c.req.param("id");
        const result = await clientService.getVacancyAccess(orgId, clientId);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/:id/users",
    requirePermission("client", "update"),
    zValidator("json", assignUserSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const clientId = c.req.param("id");
        const { userId } = c.req.valid("json");
        await clientService.assignUser(orgId, clientId, userId);
        return c.json({ success: true }, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .post(
    "/:id/invite-client-user",
    requirePermission("user", "invite"),
    zValidator("json", inviteClientUserSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const clientId = c.req.param("id");
        const { email } = c.req.valid("json");
        const result = await clientService.inviteClientUser(
          orgId,
          clientId,
          email
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  .get("/:id/users", requirePermission("client", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const clientId = c.req.param("id");
      const result = await clientService.getAssignedUsers(orgId, clientId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
