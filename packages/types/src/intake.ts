import { z } from "zod";

export const intakeSessionStateEnum = z.enum([
  "awaiting_first_reply",
  "in_progress",
  "awaiting_human",
  "completed",
]);
export type IntakeSessionState = z.infer<typeof intakeSessionStateEnum>;

export const intakeVerdictEnum = z.enum(["qualified", "rejected", "unsure"]);
export type IntakeVerdict = z.infer<typeof intakeVerdictEnum>;

export const intakeTemplateVariantEnum = z.enum([
  "first_contact",
  "reminder_24h",
  "reminder_72h",
  "no_response_farewell",
]);
export type IntakeTemplateVariant = z.infer<typeof intakeTemplateVariantEnum>;

export interface IntakeSession {
  id: string;
  organizationId: string;
  applicationId: string;
  state: IntakeSessionState;
  verdict: IntakeVerdict | null;
  verdictReason: string | null;
  mustHaveAnswers: Record<string, unknown>;
  niceToHaveAnswers: Record<string, unknown>;
  stuckCounter: Record<string, number>;
  claudeThreadId: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  reminderCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface IntakeMessage {
  id: string;
  sessionId: string;
  direction: "inbound" | "outbound";
  body: string;
  twilioSid: string | null;
  isFromBot: boolean;
  toolCalls: unknown[] | null;
  sentAt: string;
}

export interface IntakeTemplate {
  id: string;
  organizationId: string;
  variant: IntakeTemplateVariant;
  locale: string;
  name: string;
  body: string;
  isActive: boolean;
  wabaStatus: "sandbox" | "waba_pending" | "waba_approved" | "waba_rejected";
  wabaContentSid: string | null;
  createdAt: string;
  updatedAt: string | null;
}
