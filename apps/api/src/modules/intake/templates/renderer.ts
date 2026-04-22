export interface TemplateContext {
  candidate: { first_name: string; full_name: string };
  vacancy: { title: string; location: string | null; start_date: string | null };
  client: { name: string };
  tenant: { name: string };
  recruiter: { name: string; phone: string };
}

const MERGE_RE = /\{\{\s*([a-z_]+)\.([a-z_]+)\s*\}\}/g;

export function renderTemplate(body: string, ctx: TemplateContext): string {
  return body.replace(MERGE_RE, (_, scope: string, key: string) => {
    const obj = (ctx as Record<string, Record<string, unknown>>)[scope];
    if (!obj) return "";
    const val = obj[key];
    if (val === null || val === undefined) return "";
    return String(val);
  });
}
