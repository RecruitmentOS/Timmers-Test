import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { comments, activityLog, notifications } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import { getIO } from "../lib/socket.js";
import { getJobQueue } from "../lib/job-queue.js";
import { AppError } from "../lib/errors.js";
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from "@recruitment-os/types";

/**
 * Comment service — CRUD with @mention notification creation + email enqueue.
 *
 * When a comment includes mentions, the service:
 * 1. Inserts notification rows for each mentioned user
 * 2. Pushes live notifications via Socket.IO
 * 3. Enqueues a pg-boss job to email offline users (>15min inactive per D-06)
 */
export const commentService = {
  async createComment(
    orgId: string,
    input: CreateCommentInput,
    actorId: string
  ): Promise<Comment> {
    const result = await withTenantContext(orgId, async (tx) => {
      // Insert comment
      const [row] = await tx
        .insert(comments)
        .values({
          organizationId: orgId,
          targetType: input.targetType,
          targetId: input.targetId,
          authorId: actorId,
          body: input.body,
          mentions: input.mentions ?? [],
          kind: input.kind ?? "comment",
          feedbackThumb: input.feedbackThumb ?? null,
          isInternal: input.isInternal ?? true,
        })
        .returning();

      // Join author info
      const [author] = await tx
        .select({ name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, actorId));

      // Create notifications for mentioned users
      const mentionedIds = input.mentions ?? [];
      if (mentionedIds.length > 0) {
        await tx.insert(notifications).values(
          mentionedIds.map((userId) => ({
            userId,
            organizationId: orgId,
            kind: "mention" as const,
            targetType: input.targetType,
            targetId: input.targetId,
            actorId,
            meta: {
              commentId: row.id,
              bodyPreview: input.body.slice(0, 120),
            },
          }))
        );

        // Push live notification via Socket.IO
        const io = getIO();
        for (const userId of mentionedIds) {
          io.to(`user:${userId}`).emit("notification:new", {
            kind: "mention",
            actorId,
            actorName: author?.name ?? "Unknown",
            targetType: input.targetType,
            targetId: input.targetId,
            commentId: row.id,
          });
        }
      }

      // Activity log entry
      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: input.targetType,
        entityId: input.targetId,
        action: "comment_added",
        actorId,
        metadata: { commentId: row.id, kind: input.kind ?? "comment" },
      });

      return {
        ...row,
        authorName: author?.name ?? "Unknown",
        authorAvatar: author?.image ?? undefined,
      };
    });

    // Enqueue email notification job (outside transaction)
    const mentionedIds = input.mentions ?? [];
    if (mentionedIds.length > 0 && process.env.JOBS_ENABLED === "true") {
      try {
        await getJobQueue().send("send-notification-email", {
          mentionedUserIds: mentionedIds,
          commentId: result.id,
          orgId,
        });
      } catch (err) {
        console.error(
          "[commentService.createComment] failed to enqueue email job",
          err
        );
      }
    }

    return {
      id: result.id,
      organizationId: result.organizationId,
      targetType: result.targetType as Comment["targetType"],
      targetId: result.targetId,
      authorId: result.authorId,
      authorName: result.authorName,
      authorAvatar: result.authorAvatar ?? undefined,
      body: result.body,
      mentions: (result.mentions as string[]) ?? [],
      kind: result.kind as Comment["kind"],
      feedbackThumb: result.feedbackThumb as Comment["feedbackThumb"],
      isInternal: result.isInternal,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt?.toISOString() ?? null,
    };
  },

  async listComments(
    orgId: string,
    targetType: string,
    targetId: string,
    options: { includeInternal: boolean } = { includeInternal: true }
  ): Promise<Comment[]> {
    return withTenantContext(orgId, async (tx) => {
      const conditions = [
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
      ];
      if (!options.includeInternal) {
        conditions.push(eq(comments.isInternal, false));
      }

      const rows = await tx
        .select({
          id: comments.id,
          organizationId: comments.organizationId,
          targetType: comments.targetType,
          targetId: comments.targetId,
          authorId: comments.authorId,
          authorName: user.name,
          authorAvatar: user.image,
          body: comments.body,
          mentions: comments.mentions,
          kind: comments.kind,
          feedbackThumb: comments.feedbackThumb,
          isInternal: comments.isInternal,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
        })
        .from(comments)
        .leftJoin(user, eq(comments.authorId, user.id))
        .where(and(...conditions))
        .orderBy(sql`${comments.createdAt} ASC`);

      return rows.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        targetType: r.targetType as Comment["targetType"],
        targetId: r.targetId,
        authorId: r.authorId,
        authorName: r.authorName ?? "Unknown",
        authorAvatar: r.authorAvatar ?? undefined,
        body: r.body,
        mentions: (r.mentions as string[]) ?? [],
        kind: r.kind as Comment["kind"],
        feedbackThumb: r.feedbackThumb as Comment["feedbackThumb"],
        isInternal: r.isInternal,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt?.toISOString() ?? null,
      }));
    });
  },

  async updateComment(
    orgId: string,
    commentId: string,
    input: UpdateCommentInput,
    actorId: string
  ): Promise<Comment> {
    return withTenantContext(orgId, async (tx) => {
      // Verify ownership
      const [existing] = await tx
        .select()
        .from(comments)
        .where(eq(comments.id, commentId));

      if (!existing) {
        throw new AppError(404, "Comment not found");
      }
      if (existing.authorId !== actorId) {
        throw new AppError(403, "Can only edit your own comments");
      }

      const [updated] = await tx
        .update(comments)
        .set({
          body: input.body,
          mentions: input.mentions ?? existing.mentions,
          updatedAt: new Date(),
        })
        .where(eq(comments.id, commentId))
        .returning();

      const [author] = await tx
        .select({ name: user.name, image: user.image })
        .from(user)
        .where(eq(user.id, actorId));

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        targetType: updated.targetType as Comment["targetType"],
        targetId: updated.targetId,
        authorId: updated.authorId,
        authorName: author?.name ?? "Unknown",
        authorAvatar: author?.image ?? undefined,
        body: updated.body,
        mentions: (updated.mentions as string[]) ?? [],
        kind: updated.kind as Comment["kind"],
        feedbackThumb: updated.feedbackThumb as Comment["feedbackThumb"],
        isInternal: updated.isInternal,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt?.toISOString() ?? null,
      };
    });
  },

  async deleteComment(
    orgId: string,
    commentId: string,
    actorId: string
  ): Promise<void> {
    await withTenantContext(orgId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(comments)
        .where(eq(comments.id, commentId));

      if (!existing) {
        throw new AppError(404, "Comment not found");
      }
      if (existing.authorId !== actorId) {
        throw new AppError(403, "Can only delete your own comments");
      }

      await tx.delete(comments).where(eq(comments.id, commentId));
    });
  },
};
