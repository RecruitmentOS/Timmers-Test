import { and, eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { getJobQueue } from "../lib/job-queue.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { tasks, comments } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import { getIO } from "../lib/socket.js";
import { render } from "@react-email/components";
import {
  MentionNotification,
  getSubject,
} from "../emails/mention-notification.js";

type OverdueReminderData = { taskId: string; orgId: string };
type SendNotificationEmailData = {
  mentionedUserIds: string[];
  commentId: string;
  orgId: string;
};

/**
 * Register all pg-boss job handlers.
 *
 * CRITICAL RULE: Every handler MUST start its DB work with
 * `withTenantContext(job.data.orgId, async (tx) => {...})`. pg-boss
 * handlers run outside the Hono request lifecycle, so the tenant
 * context is NOT set automatically and RLS will reject queries
 * without it. Enforcing this at the handler boundary prevents
 * cross-tenant data leaks.
 */
export async function registerJobHandlers(): Promise<void> {
  if (process.env.JOBS_ENABLED !== "true") return;

  const boss = getJobQueue();

  // Delayed reminder when a task is still open past its due date.
  // Queued on task create/update; no-op if the task was completed in the meantime.
  await boss.work<OverdueReminderData>(
    "task.overdue_reminder",
    async ([job]: Job<OverdueReminderData>[]) => {
      // MUST wrap DB work in withTenantContext — pg-boss runs outside Hono.
      return withTenantContext(job.data.orgId, async (tx) => {
        const rows = await tx
          .select()
          .from(tasks)
          .where(
            and(eq(tasks.id, job.data.taskId), eq(tasks.status, "open"))
          );

        if (rows.length === 0) {
          console.log(
            `[jobs] task.overdue_reminder: task ${job.data.taskId} no longer open — noop`
          );
          return;
        }

        // Phase 2: log only. Phase 7 wires this to transactional email.
        console.log(
          `[jobs] task.overdue_reminder: task ${job.data.taskId} still open past due`
        );
      });
    }
  );

  // Send notification email for @mentions when user is offline >15min (per D-06).
  await boss.work<SendNotificationEmailData>(
    "send-notification-email",
    async ([job]: Job<SendNotificationEmailData>[]) => {
      const { mentionedUserIds, commentId, orgId } = job.data;

      await withTenantContext(orgId, async (tx) => {
        // Fetch the comment for context
        const [comment] = await tx
          .select()
          .from(comments)
          .where(eq(comments.id, commentId));

        if (!comment) {
          console.log(
            `[jobs] send-notification-email: comment ${commentId} not found — noop`
          );
          return;
        }

        // Fetch author name
        const [author] = await tx
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, comment.authorId));

        for (const userId of mentionedUserIds) {
          // Check if user is online via Socket.IO room membership
          const io = getIO();
          const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
          if (userRoom && userRoom.size > 0) {
            // User is online — skip email
            console.log(
              `[jobs] send-notification-email: user ${userId} is online — skipping`
            );
            continue;
          }

          // Fetch recipient info for email
          const [recipient] = await tx
            .select({ name: user.name, email: user.email, language: user.language })
            .from(user)
            .where(eq(user.id, userId));

          if (!recipient) continue;

          // Send email via Resend with React Email template
          const lang = (recipient.language === "en" ? "en" : "nl") as "nl" | "en";
          const authorName = author?.name ?? (lang === "en" ? "Someone" : "Iemand");
          const subject = getSubject(authorName, lang);
          const html = await render(
            MentionNotification({
              authorName,
              commentBody: comment.body,
              language: lang,
            })
          );

          if (process.env.RESEND_API_KEY) {
            try {
              const { Resend } = await import("resend");
              const resend = new Resend(process.env.RESEND_API_KEY);

              await resend.emails.send({
                from: "Recruitment OS <noreply@recruitment-os.nl>",
                to: recipient.email,
                subject,
                html,
              });

              console.log(
                `[jobs] send-notification-email: sent to ${recipient.email}`
              );
            } catch (err) {
              console.error(
                `[jobs] send-notification-email: Resend error for ${recipient.email}`,
                err
              );
            }
          } else {
            console.log(
              `[jobs] send-notification-email: RESEND_API_KEY not set — would email ${recipient.email} about mention by ${authorName}`
            );
          }
        }
      });
    }
  );
}
