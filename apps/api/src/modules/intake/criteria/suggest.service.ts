// apps/api/src/modules/intake/criteria/suggest.service.ts
import Anthropic from "@anthropic-ai/sdk";
import type { QualificationCriteria } from "@recruitment-os/types";

export interface SuggestInput {
  vacancyTitle: string;
  vacancyDescription: string | null;
  currentCriteria: QualificationCriteria;
}

export interface SuggestOutput {
  suggestedMustHaves: Array<{ key: string; question: string; expectedFormat: "yes_no" | "text" | "number" | "enum"; enumValues?: string[] }>;
  suggestedNiceToHaves: Array<{ key: string; question: string }>;
  reasoning: string;
}

export async function suggestCriteria(input: SuggestInput): Promise<SuggestOutput> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const resp = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `Je analyseert een vacature en stelt voor welke cruciale informatie bij de intake uitgevraagd moet worden. Je krijgt de vacature-beschrijving en de huidige criteria. Je geeft alleen NIEUWE suggesties die NIET al in de criteria staan. Output JSON.`,
    messages: [{
      role: "user",
      content: `Vacature: ${input.vacancyTitle}\n\nBeschrijving:\n${input.vacancyDescription ?? "(geen)"}\n\nHuidige must-haves:\n${JSON.stringify(input.currentCriteria.mustHave, null, 2)}\n\nHuidige nice-to-haves:\n${JSON.stringify(input.currentCriteria.niceToHave, null, 2)}\n\nGeef JSON met keys 'suggestedMustHaves' (list), 'suggestedNiceToHaves' (list), 'reasoning' (korte uitleg). Elke suggestie heeft 'key', 'question', en voor must-haves 'expectedFormat' ('yes_no'|'text'|'number'|'enum') + optioneel 'enumValues'.`,
    }],
  });

  const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned no JSON");
  return JSON.parse(match[0]) as SuggestOutput;
}
