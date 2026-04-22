import { renderTemplate, type TemplateContext } from "./templates/renderer.js";

export interface SessionContext extends TemplateContext {
  sessionId: string;
  orgId: string;
  candidate: TemplateContext["candidate"] & { phone: string };
}

export interface StartSessionDeps {
  loadSessionContext(sessionId: string): Promise<SessionContext>;
  loadTemplate(orgId: string, variant: string, locale?: string): Promise<{ body: string }>;
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>;
  persistOutbound(input: { sessionId: string; body: string; twilioSid: string }): Promise<void>;
  scheduleReminder(input: { sessionId: string; afterSeconds: number; variant: string }): Promise<void>;
}

export async function startSession(
  sessionId: string,
  deps: StartSessionDeps,
): Promise<void> {
  const ctx = await deps.loadSessionContext(sessionId);
  const tmpl = await deps.loadTemplate(ctx.orgId, "first_contact", "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, body, twilioSid: send.messageSid });
  await deps.scheduleReminder({ sessionId, afterSeconds: 86400, variant: "reminder_24h" });
}
