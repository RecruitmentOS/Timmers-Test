import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { cvParseService } from "../services/cv-parse.service.js";
import { errorResponse } from "../lib/errors.js";

const triggerSchema = z.object({
  fileId: z.string().uuid(),
  candidateId: z.string().uuid().optional(),
});

const hashCheckSchema = z.object({
  contentHash: z.string().min(1),
});

export const cvParseRoutes = new Hono<AppEnv>()
  /**
   * POST /trigger — Queue a CV for parsing.
   * Returns 202 with { parseLogId, status }.
   */
  .post("/trigger", zValidator("json", triggerSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { fileId, candidateId } = c.req.valid("json");
      const result = await cvParseService.triggerParse(orgId, fileId, candidateId);
      return c.json(result, 202);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /:fileId/status — Poll for parse status + parsed data.
   */
  .get("/:fileId/status", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const fileId = c.req.param("fileId");
      const result = await cvParseService.getParseStatus(orgId, fileId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * GET /log/:parseLogId — Full parse log entry (cost/audit).
   */
  .get("/log/:parseLogId", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const parseLogId = c.req.param("parseLogId");
      const result = await cvParseService.getParseLog(orgId, parseLogId);
      if (!result) {
        return c.json({ error: "Parse log not found" }, 404);
      }
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  /**
   * POST /hash — Check if a content hash has an existing parse result.
   */
  .post("/hash", zValidator("json", hashCheckSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { contentHash } = c.req.valid("json");
      const result = await cvParseService.checkDuplicate(orgId, contentHash);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
