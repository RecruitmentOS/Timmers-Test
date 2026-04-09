import { eq, and, isNull, sql, count } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { notifications } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import type { Notification } from "@recruitment-os/types";

/**
 * Notification service — read/mark-read operations for the user inbox.
 *
 * Notifications are created by other services (e.g. commentService on @mention).
 * This service only handles retrieval and read state management.
 */
export const notificationService = {
  async listNotifications(
    orgId: string,
    userId: string,
    limit = 20
  ): Promise<Notification[]> {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: notifications.id,
          userId: notifications.userId,
          organizationId: notifications.organizationId,
          kind: notifications.kind,
          targetType: notifications.targetType,
          targetId: notifications.targetId,
          actorId: notifications.actorId,
          actorName: user.name,
          meta: notifications.meta,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .leftJoin(user, eq(notifications.actorId, user.id))
        .where(eq(notifications.userId, userId))
        .orderBy(sql`${notifications.createdAt} DESC`)
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        organizationId: r.organizationId,
        kind: r.kind as Notification["kind"],
        targetType: r.targetType,
        targetId: r.targetId,
        actorId: r.actorId,
        actorName: r.actorName ?? "Unknown",
        meta: (r.meta as Record<string, unknown>) ?? {},
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  },

  async getUnreadCount(orgId: string, userId: string): Promise<number> {
    return withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .select({ value: count() })
        .from(notifications)
        .where(
          and(eq(notifications.userId, userId), isNull(notifications.readAt))
        );
      return row?.value ?? 0;
    });
  },

  async markRead(
    orgId: string,
    notificationId: string,
    userId: string
  ): Promise<void> {
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
    });
  },

  async markAllRead(orgId: string, userId: string): Promise<void> {
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.userId, userId),
            isNull(notifications.readAt)
          )
        );
    });
  },
};
