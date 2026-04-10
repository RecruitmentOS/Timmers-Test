import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { eq, and, desc } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { cvParseLogs } from "../db/schema/index.js";
import { fileMetadata } from "../db/schema/index.js";
import { fileService } from "./file.service.js";
import { getJobQueue } from "../lib/job-queue.js";
import type { CVParseResult, CVParseStatus } from "@recruitment-os/types";

const CV_PARSE_PROMPT = `Extract the following from this CV/resume. Return valid JSON only, no markdown.
Fields: firstName, lastName, email, phone, city, workExperienceSummary (brief), languages[] (ISO codes),
licenseTypes[] (from: B, C, CE, D, D1, taxi — only include if explicitly mentioned),
hasCode95 (boolean), code95Expiry (YYYY-MM-DD or null),
hasADR (boolean), adrType (basis/tank/klasse1/klasse7 or null),
drivingExperienceYears (number or null).
If a field is not found in the document, set it to null.`;

export const cvParseService = {
  /**
   * Orchestration entry point: check for duplicates, queue pg-boss job if needed.
   */
  async triggerParse(orgId: string, fileId: string, candidateId?: string) {
    return withTenantContext(orgId, async (tx) => {
      // Look up file metadata
      const [file] = await tx
        .select()
        .from(fileMetadata)
        .where(eq(fileMetadata.id, fileId));

      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // CV-06: Duplicate detection via content hash
      if (file.contentHash) {
        const [cached] = await tx
          .select()
          .from(cvParseLogs)
          .where(
            and(
              eq(cvParseLogs.contentHash, file.contentHash),
              eq(cvParseLogs.status, "success")
            )
          )
          .limit(1);

        if (cached) {
          console.log(
            `[cv-parse] duplicate detected for hash ${file.contentHash}, returning cached result`
          );
          return {
            parseLogId: cached.id,
            status: "success" as CVParseStatus,
            parsedData: cached.parsedData as CVParseResult | null,
            duplicate: true,
          };
        }
      }

      // Insert pending log entry
      const [log] = await tx
        .insert(cvParseLogs)
        .values({
          organizationId: orgId,
          fileId,
          candidateId: candidateId ?? null,
          status: "pending",
          contentHash: file.contentHash ?? null,
        })
        .returning();

      // Queue pg-boss job for async processing
      try {
        const boss = getJobQueue();
        await boss.send("cv.parse", {
          orgId,
          fileId,
          candidateId,
          s3Key: file.s3Key,
          contentHash: file.contentHash,
        }, {
          retryLimit: 2,
          retryDelay: 5,
        });
      } catch {
        // If job queue is not running (e.g. dev mode), log but don't fail
        console.warn("[cv-parse] could not queue job — job queue may not be running");
      }

      return {
        parseLogId: log.id,
        status: "pending" as CVParseStatus,
        parsedData: null,
        duplicate: false,
      };
    });
  },

  /**
   * Called by pg-boss handler. Performs the actual Claude API call.
   */
  async executeParse(
    orgId: string,
    fileId: string,
    s3Key: string,
    candidateId?: string,
    contentHash?: string
  ): Promise<CVParseResult | null> {
    // Update status to processing
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(cvParseLogs)
        .set({ status: "processing" })
        .where(eq(cvParseLogs.fileId, fileId));
    });

    // Check for API key before doing any work — CV-07 fallback
    if (!process.env.ANTHROPIC_API_KEY) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(cvParseLogs)
          .set({
            status: "error",
            errorMessage: "ANTHROPIC_API_KEY not configured",
          })
          .where(eq(cvParseLogs.fileId, fileId));
      });
      console.error("[cv-parse] ANTHROPIC_API_KEY not configured");
      return null;
    }

    const startTime = Date.now();

    try {
      // Fetch the PDF from S3
      const downloadUrl = await fileService.getDownloadUrl(s3Key);
      const fileResponse = await fetch(downloadUrl);
      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.statusText}`);
      }
      const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
      const pdfBase64 = fileBuffer.toString("base64");

      // Determine media type from the s3Key extension
      const ext = s3Key.split(".").pop()?.toLowerCase();
      let mediaType: string;
      let contentType: "document" | "image";

      if (ext === "pdf") {
        mediaType = "application/pdf";
        contentType = "document";
      } else if (ext === "jpg" || ext === "jpeg") {
        mediaType = "image/jpeg";
        contentType = "image";
      } else if (ext === "png") {
        mediaType = "image/png";
        contentType = "image";
      } else {
        // Unsupported file type
        await withTenantContext(orgId, async (tx) => {
          await tx
            .update(cvParseLogs)
            .set({
              status: "error",
              errorMessage: `Unsupported file type for parsing: .${ext}`,
              durationMs: Date.now() - startTime,
            })
            .where(eq(cvParseLogs.fileId, fileId));
        });
        return null;
      }

      // Call Claude API
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await client.messages.create({
        model: "claude-3-5-haiku-latest",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: contentType,
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: pdfBase64,
                },
              } as any,
              {
                type: "text",
                text: CV_PARSE_PROMPT,
              },
            ],
          },
        ],
      });

      // Extract text from response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }

      // Parse JSON — strip any markdown code fences if present
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\s*/, "")
          .replace(/```\s*$/, "")
          .trim();
      }

      const parsedData: CVParseResult = JSON.parse(jsonText);

      // Update log with success
      const durationMs = Date.now() - startTime;
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(cvParseLogs)
          .set({
            status: "success",
            parsedData,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            modelId: response.model,
            durationMs,
            contentHash: contentHash ?? null,
          })
          .where(eq(cvParseLogs.fileId, fileId));
      });

      console.log(
        `[cv-parse] success for file ${fileId} — ${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens, ${durationMs}ms`
      );

      return parsedData;
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      // CV-07: Log error, allow manual fallback
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(cvParseLogs)
          .set({
            status: "error",
            errorMessage: error.message || "Unknown parsing error",
            durationMs,
          })
          .where(eq(cvParseLogs.fileId, fileId));
      });

      console.error(`[cv-parse] error for file ${fileId}:`, error.message);
      throw error;
    }
  },

  /**
   * Query parse status for a given file.
   */
  async getParseStatus(orgId: string, fileId: string) {
    return withTenantContext(orgId, async (tx) => {
      const [log] = await tx
        .select()
        .from(cvParseLogs)
        .where(eq(cvParseLogs.fileId, fileId))
        .orderBy(desc(cvParseLogs.createdAt))
        .limit(1);

      if (!log) {
        return { status: null, parsedData: null, errorMessage: null };
      }

      return {
        status: log.status as CVParseStatus,
        parsedData: log.parsedData as CVParseResult | null,
        errorMessage: log.errorMessage,
      };
    });
  },

  /**
   * Get full parse log entry by ID.
   */
  async getParseLog(orgId: string, parseLogId: string) {
    return withTenantContext(orgId, async (tx) => {
      const [log] = await tx
        .select()
        .from(cvParseLogs)
        .where(eq(cvParseLogs.id, parseLogId));
      return log ?? null;
    });
  },

  /**
   * Check if a content hash already has a successful parse.
   */
  async checkDuplicate(orgId: string, contentHash: string) {
    return withTenantContext(orgId, async (tx) => {
      const [cached] = await tx
        .select()
        .from(cvParseLogs)
        .where(
          and(
            eq(cvParseLogs.contentHash, contentHash),
            eq(cvParseLogs.status, "success")
          )
        )
        .limit(1);

      return {
        duplicate: !!cached,
        parsedData: cached
          ? (cached.parsedData as CVParseResult | null)
          : null,
      };
    });
  },

  /**
   * Compute SHA-256 content hash for dedup.
   */
  computeContentHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  },
};
