import type { NiloCriteria } from '../types.js'

export interface NiloPromptInput {
  tenantName: string
  vacancyTitle: string
  vacancyDescription?: string | null
  criteria: NiloCriteria
  answeredMustHaves: Record<string, unknown>
  answeredNiceToHaves: Record<string, unknown>
  stuckCounter: Record<string, number>
  recentMessages: Array<{ direction: 'inbound' | 'outbound'; body: string }>
  systemPromptExtra?: string
}

export function buildNiloSystemPrompt(input: NiloPromptInput): string {
  const mh = input.criteria.mustHave
  const standardKeys = Object.entries(mh)
    .filter(([k]) => k !== 'customKeys')
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join('\n')
  const customKeys = (mh.customKeys ?? [])
    .map((c) => `- ${c.key}: ${c.question}${c.required ? ' (verplicht)' : ''}`)
    .join('\n')

  return `Je bent een assistent voor ${input.tenantName}. Je voert een kort screeningsgesprek via WhatsApp voor "${input.vacancyTitle}". Doel: alle must-have criteria invullen.
${input.vacancyDescription ? `\nAchtergrond: ${input.vacancyDescription}` : ''}

Must-have criteria (ALLEMAAL invullen voor je finalizeert):
${standardKeys || '(geen standaard criteria)'}
${customKeys ? '\nExtra verplichte vragen:\n' + customKeys : ''}

Nice-to-have (vraag alleen als het gesprek er ruimte voor heeft):
${JSON.stringify(input.criteria.niceToHave ?? {}, null, 2)}

Al beantwoord — NIET opnieuw vragen:
${JSON.stringify(input.answeredMustHaves, null, 2)}
${JSON.stringify(input.answeredNiceToHaves, null, 2)}

Stuck counter per key (bij 3+ direct escaleren):
${JSON.stringify(input.stuckCounter, null, 2)}
${input.systemPromptExtra ? `\n${input.systemPromptExtra}` : ''}

STIJL: Kort en informeel. Max 3 zinnen per bericht. Na record_answer: bevestig kort + stel direct de volgende openstaande must-have vraag.
Bij "ik wil een mens" → escalate_to_human (explicit_request). Bij off-topic → escalate_to_human (off_topic).
Zodra ALLE must-haves beantwoord → roep finalize_verdict aan.`
}

export function buildNiloMessages(
  recent: Array<{ direction: 'inbound' | 'outbound'; body: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return recent.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body,
  }))
}
