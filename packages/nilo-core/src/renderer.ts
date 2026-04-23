import type { NiloTemplateContext } from './types.js'

const MERGE_RE = /\{\{\s*([a-z_]+)\.([a-z_]+)\s*\}\}/g

export function renderTemplate(body: string, ctx: NiloTemplateContext): string {
  return body.replace(MERGE_RE, (_, scope: string, key: string) => {
    const obj = (ctx as unknown as Record<string, Record<string, unknown>>)[scope]
    if (!obj) return ''
    const val = obj[key]
    if (val === null || val === undefined) return ''
    return String(val)
  })
}

export function buildTemplateContext(
  session: { contactName: string | null; context: Record<string, unknown> },
  flow: { name: string },
): NiloTemplateContext {
  const firstName = session.contactName?.split(' ')[0] ?? 'there'
  return {
    candidate: {
      first_name: firstName,
      full_name: session.contactName ?? '',
    },
    vacancy: {
      title: String(session.context['vacancy_title'] ?? ''),
      location: session.context['vacancy_location'] != null
        ? String(session.context['vacancy_location'])
        : null,
      start_date: session.context['start_date'] != null
        ? String(session.context['start_date'])
        : null,
    },
    tenant: { name: flow.name },
  }
}
