// apps/api/src/services/room-timeline.service.ts
import { eq, and, or, lt, sql, desc } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { comments, activityLog } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import type {
  RoomTimelineItem,
  RoomTimelineComment,
  RoomTimelineEvent,
  RoomTimelinePage,
} from "@recruitment-os/types";

export const roomTimelineService = {
  async getTimeline(
    orgId: string,
    vacancyId: string,
    options: {
      limit?: number;
      cursor?: string;
      includeInternal?: boolean;
    } = {}
  ): Promise<RoomTimelinePage> {
    const limit = options.limit ?? 30;
    const includeInternal = options.includeInternal ?? true;

    return withTenantContext(orgId, async (tx) => {
      // --- Query 1: Comments on this vacancy ---
      const commentConditions = [
        eq(comments.targetType, "vacancy"),
        eq(comments.targetId, vacancyId),
      ];
      if (!includeInternal) {
        commentConditions.push(eq(comments.isInternal, false));
      }
      if (options.cursor) {
        commentConditions.push(lt(comments.createdAt, new Date(options.cursor)));
      }

      const commentRows = await tx
        .select({
          id: comments.id,
          authorId: comments.authorId,
          authorName: user.name,
          authorAvatar: user.image,
          body: comments.body,
          mentions: comments.mentions,
          commentKind: comments.kind,
          feedbackThumb: comments.feedbackThumb,
          isInternal: comments.isInternal,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .leftJoin(user, eq(comments.authorId, user.id))
        .where(and(...commentConditions))
        .orderBy(desc(comments.createdAt))
        .limit(limit + 1);

      // --- Query 2: Activity events for this vacancy ---
      const eventConditions = [
        or(
          and(
            eq(activityLog.entityType, "vacancy"),
            eq(activityLog.entityId, vacancyId)
          ),
          and(
            eq(activityLog.entityType, "application"),
            sql`${activityLog.metadata}->>'vacancyId' = ${vacancyId}`
          ),
          and(
            eq(activityLog.entityType, "task"),
            sql`${activityLog.metadata}->>'vacancyId' = ${vacancyId}`
          )
        ),
      ];
      if (options.cursor) {
        eventConditions.push(lt(activityLog.createdAt, new Date(options.cursor)));
      }

      const eventRows = await tx
        .select({
          id: activityLog.id,
          eventType: activityLog.action,
          actorId: activityLog.actorId,
          actorName: user.name,
          meta: activityLog.metadata,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .leftJoin(user, eq(activityLog.actorId, user.id))
        .where(and(...eventConditions))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit + 1);

      // --- Merge, sort, paginate ---
      const commentItems: RoomTimelineItem[] = commentRows.map((r) => ({
        kind: "comment" as const,
        id: r.id,
        authorId: r.authorId,
        authorName: r.authorName ?? "Unknown",
        authorAvatar: r.authorAvatar ?? undefined,
        body: r.body,
        mentions: (r.mentions as string[]) ?? [],
        commentKind: r.commentKind as RoomTimelineComment["commentKind"],
        feedbackThumb: r.feedbackThumb as RoomTimelineComment["feedbackThumb"],
        isInternal: r.isInternal,
        createdAt: r.createdAt.toISOString(),
      }));

      const eventItems: RoomTimelineItem[] = eventRows
        .filter((r) => r.eventType !== "comment_added") // avoid duplicating comments
        .map((r) => ({
          kind: "event" as const,
          id: r.id,
          eventType: r.eventType,
          actorId: r.actorId,
          actorName: r.actorName ?? "Unknown",
          meta: (r.meta as Record<string, unknown>) ?? {},
          createdAt: r.createdAt.toISOString(),
        }));

      // Merge and sort descending by createdAt
      const merged = [...commentItems, ...eventItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Take limit items + determine nextCursor
      const hasMore = merged.length > limit;
      const items = merged.slice(0, limit);
      const nextCursor = hasMore
        ? items[items.length - 1].createdAt
        : null;

      return { items, nextCursor };
    });
  },
};
