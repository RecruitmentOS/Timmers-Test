import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { documentService } from "../services/document.service.js";
import { errorResponse } from "../lib/errors.js";

const uploadDocumentSchema = z.object({
  candidateId: z.string().uuid(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  s3Key: z.string().min(1),
  documentType: z.enum(["cv", "license", "code95", "adr", "id", "other"]),
  expiresAt: z.string().optional().nullable(),
  contentHash: z.string().max(64).optional().nullable(),
});

export const documentRoutes = new Hono<AppEnv>()
  // List documents for a candidate
  .get("/candidate/:candidateId", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const candidateId = c.req.param("candidateId");
      const result = await documentService.listDocuments(orgId, candidateId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Upload document metadata (after S3 upload is complete)
  .post("/", zValidator("json", uploadDocumentSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const input = c.req.valid("json");
      const result = await documentService.uploadDocument(
        orgId,
        input.candidateId,
        input.filename,
        input.contentType,
        input.sizeBytes,
        input.s3Key,
        user.id,
        input.documentType,
        input.expiresAt,
        input.contentHash
      );
      return c.json(result, 201);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // List documents expiring within N days
  .get("/expiring", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const days = parseInt(c.req.query("days") ?? "30", 10);
      if (isNaN(days) || days < 1) {
        return c.json({ error: "Invalid days parameter" }, 400);
      }
      const result = await documentService.getExpiringDocuments(orgId, days);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Check if document with content hash already exists
  .get("/duplicate/:contentHash", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const contentHash = c.req.param("contentHash");
      const result = await documentService.findByContentHash(orgId, contentHash);
      return c.json({ exists: !!result, document: result });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
