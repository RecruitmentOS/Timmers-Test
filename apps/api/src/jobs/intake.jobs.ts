import { eq, and } from "drizzle-orm";
import type { PgBoss, Job } from "pg-boss";
import { db } from "../db/index.js";
import {
  intakeSessions, intakeMessages, intakeTemplates,
  candidateApplications, candidates, vacancies, clients,
} from "../db/schema/index.js";
import { organization } from "../db/schema/auth.js";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";
import { startSession, type StartSessionDeps } from "../modules/intake/orchestrator.js";

function gw() {
  return createTwilioSandboxGateway({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
  });
}

export function createIntakeDeps(boss: PgBoss): StartSessionDeps {
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
  console.log("[jobs] registered intake.start");
}
