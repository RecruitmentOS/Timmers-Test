import { eq, and, sql } from "drizzle-orm";
import type { PgBoss, Job } from "pg-boss";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/index.js";
import {
  intakeSessions, intakeMessages, intakeTemplates,
  candidateApplications, candidates, vacancies, clients,
} from "../db/schema/index.js";
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
    async loadSessionContext(sessionId) {
      const [row] = await db
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
        .innerJoin(organization, eq(intakeSessions.organizationId, organization.id))
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
    },
    async loadTemplate(orgId, variant, locale = "nl") {
      const [tmpl] = await db
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
    },
    async sendWhatsApp(input) { return gw().send(input); },
    async persistOutbound({ sessionId, body, twilioSid }) {
      const [sess] = await db
        .select({ organizationId: intakeSessions.organizationId })
        .from(intakeSessions)
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);
      if (!sess) return;
      await db.insert(intakeMessages).values({
        organizationId: sess.organizationId,
        sessionId, direction: "outbound", body, twilioSid, isFromBot: true,
      });
      await db
        .update(intakeSessions)
        .set({ lastOutboundAt: new Date() })
        .where(eq(intakeSessions.id, sessionId));
    },
    async scheduleReminder({ sessionId, afterSeconds, variant }) {
      await boss.send(`intake.${variant}`, { sessionId }, { startAfter: afterSeconds });
    },
    async getSessionState(sessionId) {
      const [row] = await db
        .select({
          state: intakeSessions.state,
          lastInboundAt: intakeSessions.lastInboundAt,
          createdAt: intakeSessions.createdAt,
        })
        .from(intakeSessions)
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);
      return row ?? null;
    },
    async finalizeVerdict(sessionId, status, reason) {
      await db
        .update(intakeSessions)
        .set({ state: "completed", verdict: status, verdictReason: reason, completedAt: new Date() })
        .where(eq(intakeSessions.id, sessionId));
      await boss.send("intake.fleks_pushback", { sessionId });
    },
    async incrementReminderCount(sessionId) {
      await db.execute(
        sql`UPDATE intake_sessions SET reminder_count = reminder_count + 1 WHERE id = ${sessionId}`,
      );
    },
  };
}

type StartData = { sessionId: string };

export async function registerIntakeJobs(boss: PgBoss): Promise<void> {
  const deps = createIntakeDeps(boss);
  await boss.work<StartData>(
    "intake.start",
    async ([job]: Job<StartData>[]) => {
      const { sessionId } = job.data;
      await startSession(sessionId, deps);
    }
  );
  await boss.work("intake.reminder_24h", async ([job]: any[]) => {
    await sendReminder((job.data as { sessionId: string }).sessionId, "reminder_24h", deps);
  });
  await boss.work("intake.reminder_72h", async ([job]: any[]) => {
    await sendReminder((job.data as { sessionId: string }).sessionId, "reminder_72h", deps);
  });
  await boss.work("intake.no_response_farewell", async ([job]: any[]) => {
    await sendFarewellAndClose((job.data as { sessionId: string }).sessionId, deps);
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
        .innerJoin(organization, eq(intakeSessions.organizationId, organization.id))
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
          },
          candidatePhone: row.candPhone ?? "",
        },
      );
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
