// apps/api/src/modules/intake/agent/intake-agent.ts
import type Anthropic from "@anthropic-ai/sdk";
import { INTAKE_TOOLS, type ToolName } from "./tools.js";
import { buildSystemPrompt, buildMessages, type PromptInput } from "./prompts.js";

export interface ProcessContext extends Omit<PromptInput, "answeredMustHaves" | "answeredNiceToHaves"> {
  sessionId: string;
  orgId: string;
  mustHaveAnswers: Record<string, unknown>;
  niceToHaveAnswers: Record<string, unknown>;
}

export interface ProcessDeps {
  claude: Pick<Anthropic, "messages">;
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>;
  persistOutbound(input: { sessionId: string; body: string; twilioSid: string; toolCalls?: unknown[] }): Promise<void>;
  applyToolCalls(sessionId: string, calls: Array<{ name: ToolName; input: Record<string, unknown> }>): Promise<{
    verdict: "qualified" | "rejected" | "unsure" | null;
    escalate: string | null;
  }>;
  setSessionInProgress(sessionId: string): Promise<void>;
  candidatePhone: string;
}

export async function processInbound(ctx: ProcessContext, deps: ProcessDeps): Promise<void> {
  const system = buildSystemPrompt({
    ...ctx,
    answeredMustHaves: ctx.mustHaveAnswers,
    answeredNiceToHaves: ctx.niceToHaveAnswers,
  });
  const messages = buildMessages(ctx.recentMessages);

  const response = await deps.claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    tools: INTAKE_TOOLS,
    messages,
  });

  // Collect text + tool calls
  const texts: string[] = [];
  const toolCalls: Array<{ name: ToolName; input: Record<string, unknown> }> = [];
  for (const block of response.content) {
    if (block.type === "text") texts.push(block.text);
    if (block.type === "tool_use") {
      toolCalls.push({ name: block.name as ToolName, input: block.input as Record<string, unknown> });
    }
  }

  // Apply tool calls first (they may mutate session state)
  if (toolCalls.length > 0) {
    await deps.applyToolCalls(ctx.sessionId, toolCalls);
  }

  // Send text to kandidaat (als any)
  const text = texts.join("\n").trim();
  if (text) {
    const send = await deps.sendWhatsApp({ toPhone: deps.candidatePhone, body: text });
    await deps.persistOutbound({
      sessionId: ctx.sessionId,
      body: text,
      twilioSid: send.messageSid,
      toolCalls,
    });
  }

  // Move state to in_progress (after first exchange)
  await deps.setSessionInProgress(ctx.sessionId);
}
