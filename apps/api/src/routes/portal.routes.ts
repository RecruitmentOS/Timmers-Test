import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { portalService } from "../services/portal.service.js";
import { commentService } from "../services/comment.service.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { errorResponse } from "../lib/errors.js";

// ─── Zod Schemas ───────────────────────────────────────────────

const feedbackSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  feedbackThumb: z.enum(["up", "down"]),
});

// ─── Client Portal Routes (require client_viewer role) ─────────

const clientRoutes = new Hono<AppEnv>();

// Role guard for all client routes
clientRoutes.use("/*", requireRole("client_viewer"));

clientRoutes.get("/vacancies", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const result = await portalService.getClientVacancies(orgId, user.id);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

clientRoutes.get("/placements", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const result = await portalService.getClientPlacements(orgId);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

clientRoutes.get("/vacancies/:id/candidates", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const vacancyId = c.req.param("id");
    const result = await portalService.getClientCandidates(orgId, vacancyId);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

clientRoutes.get("/vacancies/:id/activity", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const vacancyId = c.req.param("id");
    const result = await portalService.getClientActivity(orgId, vacancyId);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

clientRoutes.get("/vacancies/:id/comments", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const vacancyId = c.req.param("id");
    const result = await commentService.listComments(
      orgId,
      "vacancy",
      vacancyId,
      { includeInternal: false }
    );
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

clientRoutes.post("/feedback", zValidator("json", feedbackSchema), async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const body = c.req.valid("json");
    const result = await portalService.submitClientFeedback(orgId, body, user.id);
    return c.json(result, 201);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

// ─── HM Portal Routes (require hiring_manager role) ────────────

const hmRoutes = new Hono<AppEnv>();

// Role guard for all HM routes
hmRoutes.use("/*", requireRole("hiring_manager"));

hmRoutes.get("/vacancies", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const result = await portalService.getHMVacancies(orgId, user.id);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

hmRoutes.get("/vacancies/:id/candidates", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const vacancyId = c.req.param("id");
    const result = await portalService.getHMCandidates(orgId, user.id, vacancyId);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

hmRoutes.get("/vacancies/:id/activity", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const vacancyId = c.req.param("id");
    const result = await portalService.getClientActivity(orgId, vacancyId);
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

hmRoutes.get("/vacancies/:id/comments", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const vacancyId = c.req.param("id");
    const result = await commentService.listComments(
      orgId,
      "vacancy",
      vacancyId,
      { includeInternal: false }
    );
    return c.json(result);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

hmRoutes.post("/feedback", zValidator("json", feedbackSchema), async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const body = c.req.valid("json");
    const result = await portalService.submitHMFeedback(orgId, body, user.id);
    return c.json(result, 201);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

hmRoutes.post("/vacancies/:id/request-candidates", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const vacancyId = c.req.param("id");
    const result = await portalService.requestMoreCandidates(
      orgId,
      vacancyId,
      user.id
    );
    return c.json(result, 201);
  } catch (e) {
    return errorResponse(c, e as Error);
  }
});

// ─── Combined Portal Routes ────────────────────────────────────

export const portalRoutes = new Hono<AppEnv>();
portalRoutes.route("/client", clientRoutes);
portalRoutes.route("/hm", hmRoutes);
