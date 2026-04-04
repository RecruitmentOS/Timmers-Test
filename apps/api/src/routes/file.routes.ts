import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { fileService } from "../services/file.service.js";
import { errorResponse } from "../lib/errors.js";

const uploadUrlSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

const confirmUploadSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().uuid(),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  s3Key: z.string().min(1),
});

export const fileRoutes = new Hono<AppEnv>()
  .post("/upload-url", zValidator("json", uploadUrlSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { entityType, entityId, filename, contentType } = c.req.valid("json");
      const result = await fileService.getUploadUrl(
        orgId,
        entityType,
        entityId,
        filename,
        contentType
      );
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .post("/confirm", zValidator("json", confirmUploadSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      const { entityType, entityId, filename, contentType, sizeBytes, s3Key } =
        c.req.valid("json");
      const result = await fileService.recordUpload(
        orgId,
        entityType,
        entityId,
        filename,
        contentType,
        sizeBytes,
        s3Key,
        user.id
      );
      return c.json(result, 201);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get("/download-url", async (c) => {
    try {
      const key = c.req.query("key");
      if (!key) return c.json({ error: "Missing key parameter" }, 400);
      const url = await fileService.getDownloadUrl(key);
      return c.json({ url });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
