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
import { cvParseService } from "../services/cv-parse.service.js";
import { geocodingService } from "../services/geocoding.service.js";
import { registerBillingJobs } from "./billing-jobs.js";
import { registerMetaInsightsJobs } from "./meta-insights-sync.js";
import { registerBackupJob } from "./backup.job.js";
import { registerDataRetentionJob } from "./data-retention.job.js";

type OverdueReminderData = { taskId: string; orgId: string };
type GeocodeCandidateData = { orgId: string; candidateId: string; city: string };
type GeocodeVacancyData = { orgId: string; vacancyId: string; location: string };
type DocumentExpiryReminderData = {
  documentId: string;
  candidateId: string;
  orgId: string;
  daysUntilExpiry: number;
};
type CvParseData = {
  orgId: string;
  fileId: string;
  candidateId?: string;
  s3Key: string;
  contentHash?: string;
};
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

  // Document expiry reminder — fires 30/14/7 days before a document expires.
  // Phase 7 will wire this to transactional email; for now just log.
  await boss.work<DocumentExpiryReminderData>(
    "doc.expiry_reminder",
    async ([job]: Job<DocumentExpiryReminderData>[]) => {
      // MUST wrap DB work in withTenantContext — pg-boss runs outside Hono.
      return withTenantContext(job.data.orgId, async () => {
        console.log(
          `[jobs] doc.expiry_reminder: document ${job.data.documentId} expires in ${job.data.daysUntilExpiry} days for candidate ${job.data.candidateId}`
        );
      });
    }
  );

  // CV parse — sends PDF to Claude API for structured data extraction.
  // Queued by cvParseService.triggerParse; retries 2x with 5s delay.
  await boss.work<CvParseData>(
    "cv.parse",
    async ([job]: Job<CvParseData>[]) => {
      const { orgId, fileId, s3Key, candidateId, contentHash } = job.data;
      try {
        await cvParseService.executeParse(orgId, fileId, s3Key, candidateId, contentHash);
        console.log(`[jobs] cv.parse: completed for file ${fileId}`);
      } catch (err) {
        console.error(`[jobs] cv.parse: failed for file ${fileId}`, err);
        throw err; // pg-boss will retry
      }
    }
  );

  // Geocode candidate — calls Nominatim for candidate city.
  // Respects 1 req/sec rate limit via geocodingService internal throttle.
  await boss.work<GeocodeCandidateData>(
    "geo.geocode_candidate",
    async ([job]: Job<GeocodeCandidateData>[]) => {
      const { orgId, candidateId, city } = job.data;
      try {
        const result = await geocodingService.geocodeCandidate(orgId, candidateId, city);
        console.log(
          `[jobs] geo.geocode_candidate: ${candidateId} → ${result ? `${result.latitude},${result.longitude}` : "no result"}`
        );
      } catch (err) {
        console.error(`[jobs] geo.geocode_candidate: failed for ${candidateId}`, err);
        throw err; // pg-boss will retry
      }
    }
  );

  // Geocode vacancy — calls Nominatim for vacancy location.
  await boss.work<GeocodeVacancyData>(
    "geo.geocode_vacancy",
    async ([job]: Job<GeocodeVacancyData>[]) => {
      const { orgId, vacancyId, location } = job.data;
      try {
        const result = await geocodingService.geocodeVacancy(orgId, vacancyId, location);
        console.log(
          `[jobs] geo.geocode_vacancy: ${vacancyId} → ${result ? `${result.latitude},${result.longitude}` : "no result"}`
        );
      } catch (err) {
        console.error(`[jobs] geo.geocode_vacancy: failed for ${vacancyId}`, err);
        throw err; // pg-boss will retry
      }
    }
  );

  // Register billing cron jobs (monthly metering, trial reminders)
  await registerBillingJobs(boss);

  // Register Meta Insights sync job (daily at 06:00 UTC)
  await registerMetaInsightsJobs(boss);

  // Register nightly database backup job (02:00 UTC)
  await registerBackupJob(boss);

  // Register GDPR data retention check (03:00 UTC daily)
  await registerDataRetentionJob(boss);
}
