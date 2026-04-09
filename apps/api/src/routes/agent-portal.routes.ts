import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requireRole } from "../middleware/rbac.middleware.js";
import { agentPortalService } from "../services/agent-portal.service.js";
import { errorResponse } from "../lib/errors.js";

const stageSchema = z.object({
  stageId: z.string().uuid(),
});

const noteSchema = z.object({
  body: z.string().min(1).max(5000),
});

const statsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const agentPortalRoutes = new Hono<AppEnv>();

// Role guard: require role = 'agent'
agentPortalRoutes.use("*", requireRole("agent"));

// GET /api/agent/vacancies — agent's assigned vacancies
agentPortalRoutes.get("/vacancies", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const vacancies = await agentPortalService.getAgentVacancies(orgId, user.id);
    return c.json(vacancies);
  } catch (err) {
    return errorResponse(c, err as Error);
  }
});

// GET /api/agent/candidates — agent's assigned candidates
agentPortalRoutes.get("/candidates", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const candidates = await agentPortalService.getAgentCandidates(orgId, user.id);
    return c.json(candidates);
  } catch (err) {
    return errorResponse(c, err as Error);
  }
});

// PATCH /api/agent/candidates/:id/stage — update candidate stage
agentPortalRoutes.patch(
  "/candidates/:id/stage",
  zValidator("json", stageSchema),
  async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const applicationId = c.req.param("id");
      const { stageId } = c.req.valid("json");
      const result = await agentPortalService.updateAgentCandidateStage(
        orgId,
        applicationId,
        stageId,
        user.id
      );
      return c.json(result);
    } catch (err) {
      return errorResponse(c, err as Error);
    }
  }
);

// POST /api/agent/candidates/:id/notes — add note to candidate
agentPortalRoutes.post(
  "/candidates/:id/notes",
  zValidator("json", noteSchema),
  async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const applicationId = c.req.param("id");
      const { body } = c.req.valid("json");
      const result = await agentPortalService.addAgentNote(
        orgId,
        applicationId,
        body,
        user.id
      );
      return c.json(result);
    } catch (err) {
      return errorResponse(c, err as Error);
    }
  }
);

// GET /api/agent/tasks — agent's tasks
agentPortalRoutes.get("/tasks", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const taskList = await agentPortalService.getAgentTasks(orgId, user.id);
    return c.json(taskList);
  } catch (err) {
    return errorResponse(c, err as Error);
  }
});

// POST /api/agent/tasks/:id/complete — complete a task
agentPortalRoutes.post("/tasks/:id/complete", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const taskId = c.req.param("id");
    const result = await agentPortalService.completeAgentTask(orgId, taskId, user.id);
    return c.json(result);
  } catch (err) {
    return errorResponse(c, err as Error);
  }
});

// GET /api/agent/stats — agent's personal stats
agentPortalRoutes.get("/stats", async (c) => {
  try {
    const orgId = c.get("organizationId");
    const user = c.get("user")!;
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = await agentPortalService.getAgentStats(orgId, user.id, start, end);
    return c.json(stats);
  } catch (err) {
    return errorResponse(c, err as Error);
  }
});
