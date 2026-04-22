import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import type { PgBoss, Job } from "pg-boss";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/index.js";
import {
  intakeSessions, intakeMessages, intakeTemplates,
  candidateApplications, candidates, vacancies, clients,
  activityLog,
} from "../db/schema/index.js";

/**
 * Synthetic actor ID used for activity log rows emitted by the intake bot.
 * This is a well-known UUID that does NOT correspond to a real user row —
 * it's stored as plain text because the FK is on `text actor_id`. If a
 * future migration adds a system-bot user row, this constant stays the same.
 * Inserts are wrapped in try/catch so a missing FK row never crashes jobs.
 */
const SYSTEM_BOT_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

async function emitIntakeActivity(
  orgId: string,
  applicationId: string,
  action: string,
  meta: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(activityLog).values({
      organizationId: orgId,
      entityType: "application",
      entityId: applicationId,
      action,
      actorId: SYSTEM_BOT_ACTOR_ID,
      metadata: meta,
    });
  } catch {
    // FK violation (system bot user not in user table) — log and continue.
    // Activity log is best-effort for bot events; do not crash the job.
    console.warn(`[intake] activity_log insert skipped for action=${action} appId=${applicationId}`);
  }
}
import { organization } from "../db/schema/auth.js";
import { externalIntegrations } from "../db/schema/external-integrations.js";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";
import { startSession, sendReminder, sendFarewellAndClose, type StartSessionDeps } from "../modules/intake/orchestrator.js";
import type { ReminderDeps } from "../modules/intake/orchestrator.js";
import { processInbound } from "../modules/intake/agent/intake-agent.js";
import { createToolExecutor } from "../modules/intake/agent/tool-executor.js";
import { createToolStore } from "../modules/intake/agent/tool-store.js";
import { createFleksClient } from "../modules/intake/fleks/client.js";
import { decryptSecret } from "../lib/crypto.js";

function gw() {
  return createTwilioSandboxGateway({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
  });
}

export function createIntakeDeps(boss: PgBoss): StartSessionDeps & ReminderDeps {
  return {
    async loadSessionContext(orgId, sessionId) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select({
            sessionId: intakeSessions.id,
            orgId: intakeSessions.organizationId,
            candFirst: candidates.firstName,
            candLast: candidates.lastName,
            candPhone: candidates.phone,
            vacTitle: vacancies.title,
            vacLoc: vacancies.location,
            clientName: clients.name,
            tenantName: organization.name,
          })
          .from(intakeSessions)
          .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
          .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
          .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
          .leftJoin(clients, eq(vacancies.clientId, clients.id))
          .innerJoin(
            organization,
            sql`${intakeSessions.organizationId}::text = ${organization.id}`,
          )
          .where(eq(intakeSessions.id, sessionId))
          .limit(1);
        if (!row) throw new Error(`session not found: ${sessionId}`);
        return {
          sessionId: row.sessionId,
          orgId: row.orgId,
          candidate: {
            first_name: row.candFirst,
            full_name: `${row.candFirst} ${row.candLast}`,
            phone: row.candPhone ?? "",
          },
          vacancy: { title: row.vacTitle, location: row.vacLoc, start_date: null },
          client: { name: row.clientName ?? "" },
          tenant: { name: row.tenantName },
          recruiter: { name: "Team", phone: "" },
        };
      });
    },
    async loadTemplate(orgId, variant, locale = "nl") {
      return withTenantContext(orgId, async (tx) => {
        const [tmpl] = await tx
          .select({ body: intakeTemplates.body })
          .from(intakeTemplates)
          .where(and(
            eq(intakeTemplates.organizationId, orgId),
            eq(intakeTemplates.variant, variant),
            eq(intakeTemplates.locale, locale),
            eq(intakeTemplates.isActive, true),
          ))
          .limit(1);
        if (!tmpl) throw new Error(`template not found: ${variant}/${locale}`);
        return tmpl;
      });
    },
    async sendWhatsApp(input) { return gw().send(input); },
    async persistOutbound({ sessionId, orgId, body, twilioSid }) {
      await withTenantContext(orgId, async (tx) => {
        await tx.insert(intakeMessages).values({
          organizationId: orgId,
          sessionId, direction: "outbound", body, twilioSid, isFromBot: true,
        });
        await tx
          .update(intakeSessions)
          .set({ lastOutboundAt: new Date() })
          .where(eq(intakeSessions.id, sessionId));
      });
    },
    async scheduleReminder({ sessionId, orgId, afterSeconds, variant }) {
      await boss.send(
        `intake.${variant}`,
        { sessionId, orgId },
        { startAfter: afterSeconds },
      );
    },
    async getSessionState(orgId, sessionId) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select({
            state: intakeSessions.state,
            lastInboundAt: intakeSessions.lastInboundAt,
            createdAt: intakeSessions.createdAt,
          })
          .from(intakeSessions)
          .where(eq(intakeSessions.id, sessionId))
          .limit(1);
        return row ?? null;
      });
    },
    async finalizeVerdict(orgId, sessionId, status, reason) {
      let applicationId: string | null = null;
      let vacancyId: string | null = null;
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(intakeSessions)
          .set({ state: "completed", verdict: status, verdictReason: reason, completedAt: new Date() })
          .where(eq(intakeSessions.id, sessionId));
        const [sess] = await tx
          .select({
            applicationId: intakeSessions.applicationId,
            vacancyId: candidateApplications.vacancyId,
          })
          .from(intakeSessions)
          .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
          .where(eq(intakeSessions.id, sessionId))
          .limit(1);
        applicationId = sess?.applicationId ?? null;
        vacancyId = sess?.vacancyId ?? null;
      });
      await boss.send("intake.fleks_pushback", { sessionId, orgId });
      if (applicationId) {
        const action = status === "qualified"
          ? "intake_qualified"
          : status === "rejected"
          ? "intake_rejected"
          : "intake_unsure";
        await emitIntakeActivity(orgId, applicationId, action, {
          sessionId,
          vacancyId,
          verdict: status,
          verdictReason: reason ?? null,
        });
      }
    },
    async incrementReminderCount(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx.execute(
          sql`UPDATE intake_sessions SET reminder_count = reminder_count + 1 WHERE id = ${sessionId}`,
        );
      });
    },
  };
}

type IntakeJobData = { sessionId: string; orgId: string };

export async function registerIntakeJobs(boss: PgBoss): Promise<void> {
  const deps = createIntakeDeps(boss);
  await boss.work<IntakeJobData>(
    "intake.start",
    async ([job]: Job<IntakeJobData>[]) => {
      const { sessionId, orgId } = job.data;
      await startSession(orgId, sessionId, deps);
    }
  );
  await boss.work("intake.reminder_24h", async ([job]: any[]) => {
    const { sessionId, orgId } = job.data as IntakeJobData;
    await sendReminder(orgId, sessionId, "reminder_24h", deps);
  });
  await boss.work("intake.reminder_72h", async ([job]: any[]) => {
    const { sessionId, orgId } = job.data as IntakeJobData;
    await sendReminder(orgId, sessionId, "reminder_72h", deps);
  });
  await boss.work("intake.no_response_farewell", async ([job]: any[]) => {
    const { sessionId, orgId } = job.data as IntakeJobData;
    await sendFarewellAndClose(orgId, sessionId, deps);
  });
  await boss.work("intake.process_message", async (jobs) => {
    for (const job of jobs) {
      const { sessionId } = job.data as { sessionId: string };
      try {

      // Load ctx
      const [row] = await db
        .select({
          sessionId: intakeSessions.id,
          orgId: intakeSessions.organizationId,
          mustHaveAnswers: intakeSessions.mustHaveAnswers,
          niceToHaveAnswers: intakeSessions.niceToHaveAnswers,
          stuckCounter: intakeSessions.stuckCounter,
          candPhone: candidates.phone,
          vacTitle: vacancies.title,
          vacDesc: vacancies.description,
          criteria: vacancies.qualificationCriteria,
          clientName: clients.name,
          tenantName: organization.name,
        })
        .from(intakeSessions)
        .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
        .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
        .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
        .leftJoin(clients, eq(vacancies.clientId, clients.id))
        .innerJoin(
          organization,
          sql`${intakeSessions.organizationId}::text = ${organization.id}`,
        )
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);
      if (!row) continue;

      // Load last 20 messages
      const recent = await db
        .select({ direction: intakeMessages.direction, body: intakeMessages.body })
        .from(intakeMessages)
        .where(eq(intakeMessages.sessionId, sessionId))
        .orderBy(intakeMessages.sentAt)
        .limit(20);

      const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const executor = createToolExecutor(createToolStore());

      await processInbound(
        {
          sessionId: row.sessionId,
          orgId: row.orgId,
          tenantName: row.tenantName,
          clientName: row.clientName ?? "",
          vacancyTitle: row.vacTitle,
          vacancyDescription: row.vacDesc ?? null,
          criteria: (row.criteria as unknown as { mustHave: Record<string, unknown>; niceToHave: Record<string, unknown> }) ?? { mustHave: {}, niceToHave: {} },
          mustHaveAnswers: (row.mustHaveAnswers as Record<string, unknown>) ?? {},
          niceToHaveAnswers: (row.niceToHaveAnswers as Record<string, unknown>) ?? {},
          stuckCounter: (row.stuckCounter as Record<string, number>) ?? {},
          recentMessages: recent.map((m) => ({
            direction: m.direction as "inbound" | "outbound",
            body: m.body,
          })),
        },
        {
          claude,
          sendWhatsApp: (input) => gw().send(input),
          persistOutbound: async ({ sessionId: sid, body, twilioSid, toolCalls }) => {
            await db.insert(intakeMessages).values({
              organizationId: row.orgId,
              sessionId: sid,
              direction: "outbound",
              body,
              twilioSid,
              isFromBot: true,
              toolCalls: toolCalls ?? null,
            });
          },
          applyToolCalls: executor,
          setSessionInProgress: async (sid) => {
            await db
              .update(intakeSessions)
              .set({ state: "in_progress" })
              .where(eq(intakeSessions.id, sid));
            // Emit activity_log for Room Timeline (intake_started).
            const [appRow] = await db
              .select({
                applicationId: intakeSessions.applicationId,
                vacancyId: candidateApplications.vacancyId,
              })
              .from(intakeSessions)
              .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
              .where(eq(intakeSessions.id, sid))
              .limit(1);
            if (appRow) {
              await emitIntakeActivity(row.orgId, appRow.applicationId, "intake_started", {
                sessionId: sid,
                vacancyId: appRow.vacancyId,
              });
            }
          },
          candidatePhone: row.candPhone ?? "",
        },
      );

      // After processInbound, check if the session was escalated to a human.
      // The tool-store sets state=awaiting_human directly; we emit the activity log here.
      const [postState] = await db
        .select({
          state: intakeSessions.state,
          applicationId: intakeSessions.applicationId,
          verdictReason: intakeSessions.verdictReason,
          vacancyId: candidateApplications.vacancyId,
        })
        .from(intakeSessions)
        .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);
      if (postState?.state === "awaiting_human") {
        await emitIntakeActivity(row.orgId, postState.applicationId, "intake_escalated", {
          sessionId,
          vacancyId: postState.vacancyId,
          reason: postState.verdictReason ?? "unknown",
        });
      }
      } catch (err) {
        const Sentry = (globalThis as any).Sentry;
        if (Sentry?.captureException) Sentry.captureException(err, { extra: { sessionId } });
        throw err;
      }
    }
  });
  await boss.work("intake.fleks_pushback", async (jobs) => {
    for (const job of jobs) {
      const { sessionId } = job.data as { sessionId: string };

      const [row] = await db
        .select({
          orgId: intakeSessions.organizationId,
          verdict: intakeSessions.verdict,
          fleksEmployeeUuid: candidates.fleksEmployeeUuid,
        })
        .from(intakeSessions)
        .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
        .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);
      if (!row?.verdict || !row.fleksEmployeeUuid) continue;

      const [integ] = await db
        .select()
        .from(externalIntegrations)
        .where(eq(externalIntegrations.organizationId, row.orgId))
        .limit(1);
      if (!integ || !integ.apiKeyEncrypted) continue;

      const apiKey = process.env.FLEKS_API_KEY ?? decryptSecret(integ.apiKeyEncrypted);
      const client = createFleksClient({
        apiKey,
        baseUrl: integ.apiBaseUrl ?? "https://api.external.fleks.works",
      });
      const { pushVerdictToFleks } = await import("../modules/intake/pushback.service.js");
      await pushVerdictToFleks(client, row.fleksEmployeeUuid, row.verdict as never);
    }
  });
  console.log("[jobs] registered intake.start");
  console.log("[jobs] registered intake.reminder_24h, reminder_72h, farewell, process_message");
  console.log("[jobs] registered intake.fleks_pushback");
}
