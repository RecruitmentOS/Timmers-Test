import type { NiloFlow } from '@hey-nilo/core'

const TIMMERS_FLOW: NiloFlow = {
  id: 'timmers-default',
  orgId: process.env['TIMMERS_ORG_ID'] ?? '',
  name: 'Timmers Transport',
  locale: 'nl',
  criteria: {
    mustHave: {
      customKeys: [
        { key: 'rijbewijs_ce', question: 'Heb je een geldig rijbewijs CE?', required: true },
        { key: 'code95', question: 'Heb je een geldig Code 95 certificaat?', required: true },
        { key: 'beschikbaarheid', question: 'Wanneer ben je beschikbaar om te starten?', required: true },
        { key: 'regio', question: 'Woon je in de buurt van Rotterdam / Zuid-Holland?', required: true },
      ],
    },
    niceToHave: {
      experienceYearsMin: 2,
    },
  },
  templates: {
    first_contact:
      'Hoi {{candidate.first_name}}! 👋 Ik ben de digitale assistent van {{tenant.name}}. Je hebt interesse getoond in {{vacancy.title}}. Ik heb een paar korte vragen zodat we kunnen kijken of er een match is.\n\nHeb je een geldig rijbewijs CE?',
    reminder_24h:
      'Hoi {{candidate.first_name}}, we wachten nog op je antwoorden voor {{vacancy.title}} bij {{tenant.name}}. Heb je even 2 minuutjes?',
    reminder_72h:
      'Laatste herinnering: wil je nog reageren op onze vragen voor {{vacancy.title}}? We sluiten de aanvraag anders af.',
    no_response_farewell:
      'Helaas hebben we niets gehoord. We sluiten je aanvraag voor {{vacancy.title}} af. Succes met je zoektocht! 🍀',
  },
  reminderChain: [
    { afterSeconds: 86400, variant: 'reminder_24h' },
    { afterSeconds: 172800, variant: 'reminder_72h' },
    { afterSeconds: 86400, variant: 'no_response_farewell' },
  ],
  webhookUrl: process.env['TIMMERS_WEBHOOK_URL'],
  slackWebhookUrl: process.env['TIMMERS_SLACK_WEBHOOK_URL'],
  scoreThreshold: 75,
}

const FLOW_MAP: Record<string, NiloFlow> = {}

if (TIMMERS_FLOW.orgId) {
  FLOW_MAP[TIMMERS_FLOW.orgId] = TIMMERS_FLOW
}

export function resolveFlow(orgId: string): NiloFlow | null {
  return FLOW_MAP[orgId] ?? null
}
