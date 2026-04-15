import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { roomTimelineService } from "../services/room-timeline.service.js";
import { errorResponse } from "../lib/errors.js";
import { candidateApplications, pipelineStages, tasks } from "../db/schema/index.js";
import { eq, and, count, isNull, lt } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";

const timelineQuerySchema = z.object({
  vacancyId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  includeInternal: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export const roomTimelineRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission("activity", "read"),
    zValidator("query", timelineQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const q = c.req.valid("query");
        const result = await roomTimelineService.getTimeline(orgId, q.vacancyId, {
          limit: q.limit,
          cursor: q.cursor,
          includeInternal: q.includeInternal,
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )
  .get(
    "/stats",
    requirePermission("vacancy", "read"),
    zValidator("query", z.object({ vacancyId: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { vacancyId } = c.req.valid("query");

        const stats = await withTenantContext(orgId, async (tx) => {
          // Total applications for this vacancy
          const [totalRow] = await tx
            .select({ count: count() })
            .from(candidateApplications)
            .where(eq(candidateApplications.vacancyId, vacancyId));

          // Qualified (qualificationStatus = 'yes')
          const [qualifiedRow] = await tx
            .select({ count: count() })
            .from(candidateApplications)
            .where(
              and(
                eq(candidateApplications.vacancyId, vacancyId),
                eq(candidateApplications.qualificationStatus, "yes")
              )
            );

          // Interview stage count
          const [interviewRow] = await tx
            .select({ count: count() })
            .from(candidateApplications)
            .innerJoin(
              pipelineStages,
              eq(candidateApplications.currentStageId, pipelineStages.id)
            )
            .where(
              and(
                eq(candidateApplications.vacancyId, vacancyId),
                eq(pipelineStages.slug, "interview")
              )
            );

          // Overdue: open tasks with dueDate in the past
          const [overdueRow] = await tx
            .select({ count: count() })
            .from(tasks)
            .where(
              and(
                eq(tasks.vacancyId, vacancyId),
                eq(tasks.status, "open"),
                lt(tasks.dueDate, new Date()),
                isNull(tasks.completedAt)
              )
            );

          return {
            total: totalRow.count,
            qualified: qualifiedRow.count,
            interview: interviewRow.count,
            overdue: overdueRow.count,
          };
        });

        return c.json(stats);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
