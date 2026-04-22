import { renderTemplate, type TemplateContext } from "./templates/renderer.js";

export interface SessionContext extends TemplateContext {
  sessionId: string;
  orgId: string;
  candidate: TemplateContext["candidate"] & { phone: string };
}

export interface StartSessionDeps {
  loadSessionContext(orgId: string, sessionId: string): Promise<SessionContext>;
  loadTemplate(orgId: string, variant: string, locale?: string): Promise<{ body: string }>;
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>;
  persistOutbound(input: { sessionId: string; orgId: string; body: string; twilioSid: string }): Promise<void>;
  scheduleReminder(input: { sessionId: string; orgId: string; afterSeconds: number; variant: string }): Promise<void>;
}

export async function startSession(
  orgId: string,
  sessionId: string,
  deps: StartSessionDeps,
): Promise<void> {
  const ctx = await deps.loadSessionContext(orgId, sessionId);
  const tmpl = await deps.loadTemplate(orgId, "first_contact", "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, orgId, body, twilioSid: send.messageSid });
  await deps.scheduleReminder({ sessionId, orgId, afterSeconds: 86400, variant: "reminder_24h" });
}

export interface ReminderDeps extends StartSessionDeps {
  getSessionState(orgId: string, sessionId: string): Promise<{ state: string; lastInboundAt: Date | null; createdAt: Date } | null>;
  finalizeVerdict(orgId: string, sessionId: string, status: "qualified" | "rejected" | "unsure", reason: string): Promise<void>;
  incrementReminderCount(orgId: string, sessionId: string): Promise<void>;
}

export async function sendReminder(
  orgId: string,
  sessionId: string,
  variant: "reminder_24h" | "reminder_72h",
  deps: ReminderDeps,
): Promise<void> {
  const state = await deps.getSessionState(orgId, sessionId);
  if (!state) return;
  if (state.lastInboundAt && state.lastInboundAt > state.createdAt) return;
  if (state.state === "completed" || state.state === "awaiting_human") return;

  const ctx = await deps.loadSessionContext(orgId, sessionId);
  const tmpl = await deps.loadTemplate(orgId, variant, "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, orgId, body, twilioSid: send.messageSid });
  await deps.incrementReminderCount(orgId, sessionId);

  if (variant === "reminder_24h") {
    await deps.scheduleReminder({ sessionId, orgId, afterSeconds: 48 * 3600, variant: "reminder_72h" });
  } else {
    await deps.scheduleReminder({ sessionId, orgId, afterSeconds: 24 * 3600, variant: "no_response_farewell" });
  }
}

export async function sendFarewellAndClose(
  orgId: string,
  sessionId: string,
  deps: ReminderDeps,
): Promise<void> {
  const state = await deps.getSessionState(orgId, sessionId);
  if (!state) return;
  if (state.lastInboundAt && state.lastInboundAt > state.createdAt) return;
  if (state.state === "completed" || state.state === "awaiting_human") return;

  const ctx = await deps.loadSessionContext(orgId, sessionId);
  const tmpl = await deps.loadTemplate(orgId, "no_response_farewell", "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, orgId, body, twilioSid: send.messageSid });
  await deps.finalizeVerdict(orgId, sessionId, "rejected", "no response");
}
