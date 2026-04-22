// apps/api/src/modules/intake/agent/tools.ts
import type Anthropic from "@anthropic-ai/sdk";

export const INTAKE_TOOLS: Anthropic.Tool[] = [
  {
    name: "record_answer",
    description:
      "Sla een antwoord op voor een must-have of nice-to-have key. Alleen aanroepen wanneer kandidaat een duidelijk antwoord geeft.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Must-have of nice-to-have key (bv 'licenses', 'availability', of een customKey)" },
        value: { description: "Het antwoord. Type hangt af van key (string, number, boolean, of array)" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        source_message_id: { type: "string", description: "ID van inbound bericht waar dit uit kwam (kan leeg zijn)" },
      },
      required: ["key", "value", "confidence"],
    },
  },
  {
    name: "request_clarification",
    description:
      "Vraag opnieuw naar een must-have als het antwoord onduidelijk of tegenstrijdig was. Verhoogt stuck-counter.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        reason: { type: "string" },
      },
      required: ["key", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Zet sessie op hold en wacht op recruiter. Gebruik bij onduidelijke criteria, expliciet verzoek kandidaat, vastlopen op key, of off-topic.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          enum: ["unclear_requirements", "explicit_request", "stuck_on_key", "off_topic"],
        },
        context: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    name: "finalize_verdict",
    description:
      "Alleen aanroepen wanneer alle must-haves zijn ingevuld EN geen vervolgvragen meer nodig. Sluit sessie.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["qualified", "rejected", "unsure"] },
        summary: { type: "string", description: "2-3 zin samenvatting voor recruiter" },
        rejection_reason: { type: "string", description: "Leeg laten als qualified" },
      },
      required: ["status", "summary"],
    },
  },
];

export type ToolName = "record_answer" | "request_clarification" | "escalate_to_human" | "finalize_verdict";
