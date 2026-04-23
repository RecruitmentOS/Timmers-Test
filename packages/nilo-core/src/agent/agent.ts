import type Anthropic from '@anthropic-ai/sdk'
import { NILO_TOOLS, type NiloToolCall, type NiloToolName } from './tools.js'
import { buildNiloSystemPrompt, buildNiloMessages, type NiloPromptInput } from './prompts.js'
import { createToolExecutor } from './tool-executor.js'
import type { NiloPersistence } from '../types.js'

export interface ProcessInboundContext extends NiloPromptInput {
  orgId: string
  sessionId: string
  contactPhone: string
}

export interface ProcessInboundDeps {
  claude: Pick<Anthropic, 'messages'>
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>
  persistence: NiloPersistence
}

export async function processInbound(
  ctx: ProcessInboundContext,
  deps: ProcessInboundDeps,
): Promise<void> {
  const system = buildNiloSystemPrompt(ctx)
  const messages = buildNiloMessages(ctx.recentMessages)

  const response = await deps.claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    tools: NILO_TOOLS,
    messages,
  })

  const texts: string[] = []
  const toolCalls: NiloToolCall[] = []
  const validToolNames = new Set(NILO_TOOLS.map((t) => t.name))

  for (const block of response.content) {
    if (block.type === 'text') texts.push(block.text)
    if (block.type === 'tool_use') {
      if (!validToolNames.has(block.name)) {
        console.warn(`[nilo-agent] unknown tool from Claude: ${block.name} — skipping`)
        continue
      }
      toolCalls.push({ name: block.name as NiloToolName, input: block.input as Record<string, unknown> })
    }
  }

  const exec = createToolExecutor(ctx.orgId, ctx.sessionId, deps.persistence)
  if (toolCalls.length > 0) {
    await exec(toolCalls)
  }

  const text = texts.join('\n').trim()
  let messageSid = ''
  if (text) {
    const send = await deps.sendWhatsApp({ toPhone: ctx.contactPhone, body: text })
    messageSid = send.messageSid
  }
  if (text || toolCalls.length > 0) {
    await deps.persistence.persistOutbound(ctx.orgId, ctx.sessionId, text, messageSid, toolCalls)
  }

  await deps.persistence.setInProgress(ctx.orgId, ctx.sessionId)
}
