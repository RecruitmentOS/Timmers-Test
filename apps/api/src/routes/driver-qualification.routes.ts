import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { driverQualificationService } from "../services/driver-qualification.service.js";
import { errorResponse } from "../lib/errors.js";

const createSchema = z.object({
  candidateId: z.string().uuid(),
  type: z.enum([
    "B",
    "C",
    "CE",
    "D",
    "D1",
    "taxi",
    "code95",
    "adr",
    "digitachograaf",
  ]),
  adrType: z
    .enum(["basis", "tank", "klasse1", "klasse7"])
    .optional()
    .nullable(),
  cardNumber: z.string().max(50).optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

const updateSchema = createSchema.omit({ candidateId: true }).partial();

export const driverQualificationRoutes = new Hono<AppEnv>()
  // List qualifications for a candidate
  .get("/:candidateId", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const candidateId = c.req.param("candidateId");
      const result = await driverQualificationService.list(orgId, candidateId);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Get license badges for pipeline card display
  .get("/:candidateId/badges", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const candidateId = c.req.param("candidateId");
      const badges = await driverQualificationService.getLicenseBadges(
        orgId,
        candidateId
      );
      return c.json(badges);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Check license mismatch for a candidate against a vacancy
  .get("/:candidateId/mismatch/:vacancyId", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const candidateId = c.req.param("candidateId");
      const vacancyId = c.req.param("vacancyId");
      const result = await driverQualificationService.checkLicenseMismatch(
        orgId,
        candidateId,
        vacancyId
      );
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Create a new qualification
  .post("/", zValidator("json", createSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const body = c.req.valid("json");
      const result = await driverQualificationService.create(orgId, {
        candidateId: body.candidateId,
        type: body.type,
        adrType: body.adrType ?? undefined,
        cardNumber: body.cardNumber ?? undefined,
        issuedAt: body.issuedAt ?? undefined,
        expiresAt: body.expiresAt ?? undefined,
      });
      return c.json(result, 201);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Update a qualification
  .put("/:id", zValidator("json", updateSchema), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      const body = c.req.valid("json");
      const input: Partial<Omit<import("@recruitment-os/types").CreateDriverQualificationInput, "candidateId">> = {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.adrType !== undefined && { adrType: body.adrType ?? undefined }),
        ...(body.cardNumber !== undefined && { cardNumber: body.cardNumber ?? undefined }),
        ...(body.issuedAt !== undefined && { issuedAt: body.issuedAt ?? undefined }),
        ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ?? undefined }),
      };
      const result = await driverQualificationService.update(orgId, id, input);
      if (!result) return c.json({ error: "Not found" }, 404);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  // Delete a qualification
  .delete("/:id", async (c) => {
    try {
      const orgId = c.get("organizationId");
      const id = c.req.param("id");
      await driverQualificationService.remove(orgId, id);
      return c.json({ success: true });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
