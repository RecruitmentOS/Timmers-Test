import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { interviewService } from "../services/interview.service.js";
import { errorResponse } from "../lib/errors.js";

const scheduleSchema = z.object({
  applicationId: z.string().uuid(),
  vacancyId: z.string().uuid(),
  candidateId: z.string().uuid(),
  calendarConnectionId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  candidateName: z.string().min(1),
  candidateEmail: z.string().email().optional(),
  vacancyTitle: z.string().min(1),
});

const updateSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  notes: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  location: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  vacancyId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
});

export const interviewRoutes = new Hono<AppEnv>()
  /**
   * POST / — Schedule a new interview
   */
  .post(
    "/",
    requirePermission("interview", "create"),
    zValidator("json", scheduleSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const input = c.req.valid("json");
        const result = await interviewService.schedule(orgId, input, user.id);
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  /**
   * GET / — List interviews with optional filters
   */
  .get(
    "/",
    requirePermission("interview", "read"),
    zValidator("query", listQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const q = c.req.valid("query");
        const result = await interviewService.list(orgId, q);
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  /**
   * PATCH /:id — Update interview
   */
  .patch(
    "/:id",
    requirePermission("interview", "update"),
    zValidator("json", updateSchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const data = c.req.valid("json");
        const result = await interviewService.update(orgId, id, data);
        if (!result) {
          return c.json({ error: "Interview niet gevonden" }, 404);
        }
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  /**
   * DELETE /:id — Cancel interview
   */
  .delete(
    "/:id",
    requirePermission("interview", "delete"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const result = await interviewService.cancel(orgId, id);
        if (!result) {
          return c.json({ error: "Interview niet gevonden" }, 404);
        }
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  /**
   * POST /:id/scorecard — Create or update a scorecard for an interview
   */
  .post(
    "/:id/scorecard",
    requirePermission("interview", "update"),
    zValidator(
      "json",
      z.object({
        criteria: z
          .array(
            z.object({
              label: z.string().min(1),
              rating: z.number().int().min(1).max(5),
              notes: z.string(),
            })
          )
          .min(1),
        overallRating: z.number().int().min(1).max(5),
        recommendation: z.enum(["proceed", "hold", "reject"]),
        notes: z.string().optional(),
      })
    ),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const user = c.get("user")!;
        const interviewId = c.req.param("id");
        const input = c.req.valid("json");
        const result = await interviewService.createScorecard(
          orgId,
          interviewId,
          input,
          user.id
        );
        return c.json(result, 201);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  /**
   * GET /:id/scorecard — Get the scorecard for an interview
   */
  .get(
    "/:id/scorecard",
    requirePermission("interview", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const interviewId = c.req.param("id");
        const result = await interviewService.getScorecard(orgId, interviewId);
        if (!result) return c.json({ scorecard: null });
        return c.json({ scorecard: result });
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
