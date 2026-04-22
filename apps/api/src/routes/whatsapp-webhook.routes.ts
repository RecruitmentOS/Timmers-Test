// apps/api/src/routes/whatsapp-webhook.routes.ts
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { db } from "../db/index.js";
import {
  intakeSessions, intakeMessages, candidateApplications, candidates,
} from "../db/schema/index.js";
import { getJobQueue } from "../lib/job-queue.js";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";

export const whatsAppWebhookRoutes = new Hono<AppEnv>().post("/twilio", async (c) => {
  const raw = await c.req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const signature = c.req.header("X-Twilio-Signature") ?? "";
  const gw = createTwilioSandboxGateway({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
  });
  const fullUrl = `${c.req.url}`;

  if (process.env.TWILIO_VERIFY_WEBHOOKS !== "false") {
    if (!gw.verifyWebhook(signature, fullUrl, params)) {
      console.warn("[twilio-webhook] signature mismatch");
      return c.text("bad signature", 403);
    }
  }

  const parsed = gw.parseWebhook(params);

  // Resolve session by inbound phone (try awaiting_first_reply first, then in_progress)
  let sessionRow;
  for (const st of ["awaiting_first_reply", "in_progress"] as const) {
    const rows = await db
      .select({
        sessionId: intakeSessions.id,
        organizationId: intakeSessions.organizationId,
      })
      .from(intakeSessions)
      .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
      .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
      .where(
        and(
          eq(candidates.phone, parsed.fromPhone),
          eq(intakeSessions.state, st),
        ),
      )
      .limit(1);
    if (rows[0]) { sessionRow = rows[0]; break; }
  }

  if (!sessionRow) {
    console.warn(`[twilio-webhook] no session for ${parsed.fromPhone}`);
    return c.text("no session", 200);
  }

  await db.insert(intakeMessages).values({
    organizationId: sessionRow.organizationId,
    sessionId: sessionRow.sessionId,
    direction: "inbound",
    body: parsed.body,
    twilioSid: parsed.messageSid,
    isFromBot: false,
  });

  await db
    .update(intakeSessions)
    .set({ lastInboundAt: new Date() })
    .where(eq(intakeSessions.id, sessionRow.sessionId));

  await getJobQueue().send("intake.process_message", { sessionId: sessionRow.sessionId });

  return c.text("ok", 200);
});
