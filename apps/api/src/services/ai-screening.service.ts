import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and, desc, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { aiScreeningLogs } from "../db/schema/ai-screening-logs.js";
import { aiUsage } from "../db/schema/ai-usage.js";
import { candidateApplications } from "../db/schema/applications.js";
import { vacancies } from "../db/schema/vacancies.js";
import { candidates } from "../db/schema/candidates.js";
import { driverQualifications } from "../db/schema/driver-qualifications.js";
import { db } from "../db/index.js";
import { AppError } from "../lib/errors.js";
import type {
  AIScreeningResult,
  AIScreeningResponse,
  AIScreeningStatus,
} from "@recruitment-os/types";

const SCREENING_SYSTEM_PROMPT = `You are a recruitment screening assistant for transport/logistics roles in NL/BE. Evaluate the candidate against the vacancy requirements. Return JSON only with this exact structure:
{
  "verdict": "yes" | "maybe" | "no",
  "reasoning": "Brief explanation in Dutch",
  "confidence": 0.0 to 1.0,
  "matchedCriteria": ["criteria that match"],
  "missingCriteria": ["criteria that are missing or unclear"]
}
Do not include any text outside the JSON object.`;

function buildScreeningPrompt(
  vacancy: {
    title: string;
    qualificationCriteria: unknown;
    requiredLicenses: unknown;
  },
  candidate: {
    firstName: string;
    lastName: string;
    city: string | null;
  },
  qualifications: Array<{
    type: string;
    adrType: string | null;
    expiresAt: string | null;
  }>
): string {
  const criteria = vacancy.qualificationCriteria
    ? JSON.stringify(vacancy.qualificationCriteria)
    : "Geen specifieke criteria opgegeven";
  const licenses = vacancy.requiredLicenses
    ? JSON.stringify(vacancy.requiredLicenses)
    : "Geen specifieke rijbewijzen vereist";
  const quals = qualifications.length > 0
    ? qualifications
        .map((q) => `${q.type}${q.adrType ? ` (${q.adrType})` : ""}${q.expiresAt ? ` geldig tot ${q.expiresAt}` : ""}`)
        .join(", ")
    : "Geen kwalificaties geregistreerd";

  return `<vacancy_criteria>
Functie: ${vacancy.title}
Kwalificatiecriteria: ${criteria}
</vacancy_criteria>

<required_licenses>
${licenses}
</required_licenses>

<candidate_profile>
Naam: ${candidate.firstName} ${candidate.lastName}
Woonplaats: ${candidate.city || "Onbekend"}
Rijbewijzen en certificaten: ${quals}
</candidate_profile>

Beoordeel deze kandidaat op basis van de vacature-eisen.`;
}

function buildContentHash(
  qualificationCriteria: unknown,
  requiredLicenses: unknown,
  qualifications: Array<{ type: string; adrType: string | null; expiresAt: string | null }>
): string {
  const data = `${JSON.stringify(qualificationCriteria ?? null)}|${JSON.stringify(requiredLicenses ?? null)}|${JSON.stringify(qualifications)}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const aiScreeningService = {
  /**
   * Trigger AI screening for a candidate application.
   * Checks cache, enforces quota, calls Claude, logs result.
   */
  async triggerScreening(
    orgId: string,
    applicationId: string,
    force = false
  ): Promise<AIScreeningResponse> {
    // 1. Load application + vacancy + candidate + driver qualifications
    const appData = await withTenantContext(orgId, async (tx) => {
      const [application] = await tx
        .select()
        .from(candidateApplications)
        .where(eq(candidateApplications.id, applicationId));

      if (!application) {
        throw new AppError(404, "Application not found");
      }

      const [vacancy] = await tx
        .select()
        .from(vacancies)
        .where(eq(vacancies.id, application.vacancyId));

      if (!vacancy) {
        throw new AppError(404, "Vacancy not found");
      }

      const [candidate] = await tx
        .select()
        .from(candidates)
        .where(eq(candidates.id, application.candidateId));

      if (!candidate) {
        throw new AppError(404, "Candidate not found");
      }

      const quals = await tx
        .select()
        .from(driverQualifications)
        .where(eq(driverQualifications.candidateId, application.candidateId));

      return { application, vacancy, candidate, qualifications: quals };
    });

    const { application, vacancy, candidate, qualifications } = appData;

    // 2. Build content hash for caching
    const qualData = qualifications.map((q) => ({
      type: q.type,
      adrType: q.adrType,
      expiresAt: q.expiresAt,
    }));
    const contentHash = buildContentHash(
      vacancy.qualificationCriteria,
      vacancy.requiredLicenses,
      qualData
    );

    // 3. Check cache (skip if force=true)
    if (!force) {
      const cached = await withTenantContext(orgId, async (tx) => {
        const [existing] = await tx
          .select()
          .from(aiScreeningLogs)
          .where(
            and(
              eq(aiScreeningLogs.contentHash, contentHash),
              eq(aiScreeningLogs.status, "success")
            )
          )
          .limit(1);
        return existing;
      });

      if (cached) {
        console.log(
          `[ai-screening] cache hit for hash ${contentHash.slice(0, 12)}...`
        );
        return {
          screeningLogId: cached.id,
          status: "success",
          result: {
            verdict: cached.verdict as AIScreeningResult["verdict"],
            reasoning: cached.reasoning ?? "",
            confidence: parseFloat(cached.confidence ?? "0"),
            matchedCriteria: (cached.matchedCriteria as string[]) ?? [],
            missingCriteria: (cached.missingCriteria as string[]) ?? [],
          },
          cached: true,
        };
      }
    }

    // 4. Atomic quota check-and-increment
    const monthKey = getCurrentMonthKey();
    const quotaOk = await (async () => {
      // UPSERT the month row if it doesn't exist
      await db
        .insert(aiUsage)
        .values({
          organizationId: orgId,
          monthKey,
          screeningCount: 0,
          screeningTokens: 0,
          parseCount: 0,
          parseTokens: 0,
          quotaLimit: 500,
        })
        .onConflictDoNothing();

      // Atomic increment with quota guard
      const result = await db.execute(
        sql`UPDATE ai_usage SET screening_count = screening_count + 1, updated_at = NOW() WHERE organization_id = ${orgId} AND month_key = ${monthKey} AND screening_count < quota_limit RETURNING *`
      );
      return (result as any).rows?.length > 0 || (result as any).length > 0;
    })();

    if (!quotaOk) {
      throw new AppError(429, "AI-limiet bereikt voor deze maand", "QUOTA_EXCEEDED");
    }

    // 5. Dormant-safe: check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      // Insert error log
      const [errorLog] = await withTenantContext(orgId, async (tx) => {
        return tx
          .insert(aiScreeningLogs)
          .values({
            organizationId: orgId,
            applicationId,
            vacancyId: application.vacancyId,
            candidateId: application.candidateId,
            status: "error",
            errorMessage: "AI screening not configured — ANTHROPIC_API_KEY missing",
            contentHash,
          })
          .returning();
      });

      return {
        screeningLogId: errorLog.id,
        status: "error",
        cached: false,
      };
    }

    // 6. Insert pending log row
    const [pendingLog] = await withTenantContext(orgId, async (tx) => {
      return tx
        .insert(aiScreeningLogs)
        .values({
          organizationId: orgId,
          applicationId,
          vacancyId: application.vacancyId,
          candidateId: application.candidateId,
          status: "pending",
          contentHash,
        })
        .returning();
    });

    // 7. Call Claude
    const startTime = Date.now();
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const prompt = buildScreeningPrompt(
        {
          title: vacancy.title,
          qualificationCriteria: vacancy.qualificationCriteria,
          requiredLicenses: vacancy.requiredLicenses,
        },
        {
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          city: candidate.city,
        },
        qualData
      );

      const response = await client.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 1024,
        system: SCREENING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      // 8. Parse response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }

      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*/, "")
          .replace(/```\s*$/, "")
          .trim();
      }

      const parsed: AIScreeningResult = JSON.parse(jsonText);

      // Validate verdict
      if (!["yes", "maybe", "no"].includes(parsed.verdict)) {
        throw new Error(`Invalid verdict: ${parsed.verdict}`);
      }

      const durationMs = Date.now() - startTime;

      // 9. Update log with result
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(aiScreeningLogs)
          .set({
            status: "success",
            verdict: parsed.verdict,
            reasoning: parsed.reasoning,
            confidence: String(parsed.confidence),
            matchedCriteria: parsed.matchedCriteria,
            missingCriteria: parsed.missingCriteria,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            modelId: response.model,
            durationMs,
          })
          .where(eq(aiScreeningLogs.id, pendingLog.id));
      });

      // 10. Update ai_usage token counter
      await db.execute(
        sql`UPDATE ai_usage SET screening_tokens = screening_tokens + ${response.usage.input_tokens + response.usage.output_tokens}, updated_at = NOW() WHERE organization_id = ${orgId} AND month_key = ${monthKey}`
      );

      console.log(
        `[ai-screening] success for application ${applicationId} — verdict=${parsed.verdict}, ${response.usage.input_tokens}in/${response.usage.output_tokens}out tokens, ${durationMs}ms`
      );

      return {
        screeningLogId: pendingLog.id,
        status: "success" as AIScreeningStatus,
        result: parsed,
        cached: false,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(aiScreeningLogs)
          .set({
            status: "error",
            errorMessage: error.message || "Unknown screening error",
            durationMs,
          })
          .where(eq(aiScreeningLogs.id, pendingLog.id));
      });

      console.error(
        `[ai-screening] error for application ${applicationId}:`,
        error.message
      );
      throw error;
    }
  },

  /**
   * Get a single screening result by log ID.
   */
  async getScreeningResult(orgId: string, screeningLogId: string) {
    return withTenantContext(orgId, async (tx) => {
      const [log] = await tx
        .select()
        .from(aiScreeningLogs)
        .where(eq(aiScreeningLogs.id, screeningLogId));
      return log ?? null;
    });
  },

  /**
   * Get screening history for an application, newest first.
   */
  async getScreeningHistory(orgId: string, applicationId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(aiScreeningLogs)
        .where(eq(aiScreeningLogs.applicationId, applicationId))
        .orderBy(desc(aiScreeningLogs.createdAt));
    });
  },

  /**
   * Get current month AI usage for an organization.
   */
  async getUsage(orgId: string) {
    const monthKey = getCurrentMonthKey();
    const [usage] = await db
      .select()
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.organizationId, orgId),
          eq(aiUsage.monthKey, monthKey)
        )
      );

    if (!usage) {
      // Return defaults if no row yet
      return {
        screeningCount: 0,
        screeningTokens: 0,
        parseCount: 0,
        parseTokens: 0,
        quotaLimit: 500,
        monthKey,
      };
    }

    return usage;
  },
};
