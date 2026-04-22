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

export interface ReminderDeps extends StartSessionDeps {
  getSessionState(sessionId: string): Promise<{ state: string; lastInboundAt: Date | null; createdAt: Date } | null>;
  finalizeVerdict(sessionId: string, status: "qualified" | "rejected" | "unsure", reason: string): Promise<void>;
  incrementReminderCount(sessionId: string): Promise<void>;
}

export async function sendReminder(
  sessionId: string,
  variant: "reminder_24h" | "reminder_72h",
  deps: ReminderDeps,
): Promise<void> {
  const state = await deps.getSessionState(sessionId);
  if (!state) return;
  if (state.lastInboundAt && state.lastInboundAt > state.createdAt) return;
  if (state.state === "completed" || state.state === "awaiting_human") return;

  const ctx = await deps.loadSessionContext(sessionId);
  const tmpl = await deps.loadTemplate(ctx.orgId, variant, "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, body, twilioSid: send.messageSid });
  await deps.incrementReminderCount(sessionId);

  if (variant === "reminder_24h") {
    await deps.scheduleReminder({ sessionId, afterSeconds: 48 * 3600, variant: "reminder_72h" });
  } else {
    await deps.scheduleReminder({ sessionId, afterSeconds: 24 * 3600, variant: "no_response_farewell" });
  }
}

export async function sendFarewellAndClose(
  sessionId: string,
  deps: ReminderDeps,
): Promise<void> {
  const state = await deps.getSessionState(sessionId);
  if (!state) return;
  if (state.lastInboundAt && state.lastInboundAt > state.createdAt) return;
  if (state.state === "completed" || state.state === "awaiting_human") return;

  const ctx = await deps.loadSessionContext(sessionId);
  const tmpl = await deps.loadTemplate(ctx.orgId, "no_response_farewell", "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, body, twilioSid: send.messageSid });
  await deps.finalizeVerdict(sessionId, "rejected", "no response");
}
