// apps/api/src/routes/intake.routes.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, sql } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import {
  vacancies,
  intakeSessions,
  intakeMessages,
  candidateApplications,
  candidates,
} from "../db/schema/index.js";
import { suggestCriteria } from "../modules/intake/criteria/suggest.service.js";
import { errorResponse } from "../lib/errors.js";
import { qualificationCriteriaSchema } from "@recruitment-os/types";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";
import { getJobQueue } from "../lib/job-queue.js";

export const intakeRoutes = new Hono<AppEnv>()
  .post(
    "/criteria/suggest",
    requirePermission("vacancy", "update"),
    zValidator("json", z.object({ vacancyId: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { vacancyId } = c.req.valid("json");
        const [vac] = await db
          .select({
            title: vacancies.title,
            description: vacancies.description,
            criteria: vacancies.qualificationCriteria,
          })
          .from(vacancies)
          .where(
            and(eq(vacancies.id, vacancyId), eq(vacancies.organizationId, orgId)),
          )
          .limit(1);
        if (!vac) return c.json({ error: "vacancy not found" }, 404);
        const parsed = qualificationCriteriaSchema.parse(vac.criteria ?? { mustHave: {}, niceToHave: {} });
        const result = await suggestCriteria({
          vacancyTitle: vac.title,
          vacancyDescription: vac.description ?? null,
          currentCriteria: parsed,
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    },
  )
  .get(
    "/sessions",
    requirePermission("application", "read"),
    zValidator("query", z.object({
      state: z.enum(["awaiting_first_reply", "in_progress", "awaiting_human", "completed"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { state, limit } = c.req.valid("query");
        const where = state
          ? and(eq(intakeSessions.organizationId, orgId), eq(intakeSessions.state, state))
          : eq(intakeSessions.organizationId, orgId);
        const rows = await db
          .select({
            id: intakeSessions.id,
            state: intakeSessions.state,
            verdict: intakeSessions.verdict,
            createdAt: intakeSessions.createdAt,
            lastInboundAt: intakeSessions.lastInboundAt,
            lastOutboundAt: intakeSessions.lastOutboundAt,
            candidateName: sql<string>`${candidates.firstName} || ' ' || ${candidates.lastName}`,
            vacancyTitle: vacancies.title,
          })
          .from(intakeSessions)
          .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
          .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
          .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
          .where(where)
          .orderBy(desc(intakeSessions.createdAt))
          .limit(limit);
        return c.json({ sessions: rows });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .get(
    "/sessions/:id",
    requirePermission("application", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const [session] = await db
          .select()
          .from(intakeSessions)
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)))
          .limit(1);
        if (!session) return c.json({ error: "not found" }, 404);
        const messages = await db
          .select()
          .from(intakeMessages)
          .where(eq(intakeMessages.sessionId, id))
          .orderBy(intakeMessages.sentAt);
        return c.json({ session, messages });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .post(
    "/sessions/:id/takeover",
    requirePermission("application", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        await db
          .update(intakeSessions)
          .set({ state: "awaiting_human" })
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)));
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .post(
    "/sessions/:id/reply",
    requirePermission("application", "update"),
    zValidator("json", z.object({ body: z.string().min(1).max(2000) })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { body } = c.req.valid("json");
        // Load session + phone
        const [row] = await db
          .select({ orgId: intakeSessions.organizationId, phone: candidates.phone })
          .from(intakeSessions)
          .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
          .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)))
          .limit(1);
        if (!row) return c.json({ error: "not found" }, 404);
        const gw = createTwilioSandboxGateway({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
        });
        const send = await gw.send({ toPhone: row.phone ?? "", body });
        await db.insert(intakeMessages).values({
          organizationId: row.orgId,
          sessionId: id,
          direction: "outbound",
          body,
          twilioSid: send.messageSid,
          isFromBot: false,
        });
        await db
          .update(intakeSessions)
          .set({ lastOutboundAt: new Date() })
          .where(eq(intakeSessions.id, id));
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .post(
    "/sessions/:id/manual-verdict",
    requirePermission("application", "update"),
    zValidator("json", z.object({
      verdict: z.enum(["qualified", "rejected", "unsure"]),
      reason: z.string().min(1),
    })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { verdict, reason } = c.req.valid("json");
        await db
          .update(intakeSessions)
          .set({ state: "completed", verdict, verdictReason: reason, completedAt: new Date() })
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)));
        await getJobQueue().send("intake.fleks_pushback", { sessionId: id });
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  );
