import { eq, and, or, lt, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { activityLog } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import type { ActivityEvent } from "@recruitment-os/types";

/**
 * Activity service — chronological event stream for vacancy detail pages.
 *
 * Per D-08: flat chronological stream with cursor-based pagination.
 * Events include comments, stage changes, tasks, qualifications, etc.
 * for a vacancy and its related applications.
 */
export const activityService = {
  async listActivity(
    orgId: string,
    vacancyId: string,
    limit = 20,
    cursor?: string
  ): Promise<{ events: ActivityEvent[]; nextCursor: string | null }> {
    return withTenantContext(orgId, async (tx) => {
      const conditions = [
        or(
          // Direct vacancy events
          and(
            eq(activityLog.entityType, "vacancy"),
            eq(activityLog.entityId, vacancyId)
          ),
          // Application events related to this vacancy (stored in metadata)
          and(
            eq(activityLog.entityType, "application"),
            sql`${activityLog.metadata}->>'vacancyId' = ${vacancyId}`
          ),
          // Task events related to this vacancy
          and(
            eq(activityLog.entityType, "task"),
            sql`${activityLog.metadata}->>'vacancyId' = ${vacancyId}`
          ),
          // Comment events with targetType vacancy
          and(
            eq(activityLog.entityType, "vacancy"),
            eq(activityLog.entityId, vacancyId)
          )
        ),
      ];

      if (cursor) {
        conditions.push(lt(activityLog.createdAt, new Date(cursor)));
      }

      // Fetch one extra to determine if there's a next page
      const rows = await tx
        .select({
          id: activityLog.id,
          eventType: activityLog.action,
          actorId: activityLog.actorId,
          actorName: user.name,
          targetType: activityLog.entityType,
          targetId: activityLog.entityId,
          meta: activityLog.metadata,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .leftJoin(user, eq(activityLog.actorId, user.id))
        .where(and(...conditions))
        .orderBy(sql`${activityLog.createdAt} DESC`)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      const events: ActivityEvent[] = items.map((r) => ({
        id: r.id,
        eventType: r.eventType as ActivityEvent["eventType"],
        actorId: r.actorId,
        actorName: r.actorName ?? "Unknown",
        targetType: r.targetType,
        targetId: r.targetId,
        meta: (r.meta as Record<string, unknown>) ?? {},
        createdAt: r.createdAt.toISOString(),
      }));

      const nextCursor = hasMore
        ? items[items.length - 1].createdAt.toISOString()
        : null;

      return { events, nextCursor };
    });
  },
};
