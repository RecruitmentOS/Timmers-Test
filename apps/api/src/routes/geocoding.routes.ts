import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { geocodingService } from "../services/geocoding.service.js";
import { candidateService } from "../services/candidate.service.js";
import { vacancyService } from "../services/vacancy.service.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { AppError, errorResponse } from "../lib/errors.js";

const radiusQuerySchema = z.object({
  km: z.coerce.number().min(1).max(500).default(25),
});

export const geocodingRoutes = new Hono<AppEnv>()
  /**
   * GET /radius/:vacancyId?km=25
   * Search candidates within a radius of a vacancy location.
   */
  .get(
    "/radius/:vacancyId",
    requirePermission("candidate", "read"),
    zValidator("query", radiusQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("vacancyId");
        const { km } = c.req.valid("query");

        const results = await geocodingService.searchByRadius(
          orgId,
          vacancyId,
          km
        );
        return c.json(results);
      } catch (err) {
        return errorResponse(c, err as Error);
      }
    }
  )

  /**
   * POST /geocode/candidate/:candidateId
   * Manually trigger geocoding for a candidate.
   */
  .post(
    "/geocode/candidate/:candidateId",
    requirePermission("candidate", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const candidateId = c.req.param("candidateId");

        const candidate = await candidateService.getById(orgId, candidateId);
        if (!candidate) {
          throw new AppError(404, "Candidate not found");
        }
        if (!candidate.city) {
          throw new AppError(400, "Candidate has no city set");
        }

        const coords = await geocodingService.geocodeCandidate(
          orgId,
          candidateId,
          candidate.city
        );

        if (!coords) {
          return c.json({ error: "Could not geocode city" }, 422);
        }

        return c.json(coords);
      } catch (err) {
        return errorResponse(c, err as Error);
      }
    }
  )

  /**
   * POST /geocode/vacancy/:vacancyId
   * Manually trigger geocoding for a vacancy.
   */
  .post(
    "/geocode/vacancy/:vacancyId",
    requirePermission("vacancy", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const vacancyId = c.req.param("vacancyId");

        const vacancy = await vacancyService.getById(orgId, vacancyId);
        if (!vacancy) {
          throw new AppError(404, "Vacancy not found");
        }
        if (!vacancy.location) {
          throw new AppError(400, "Vacancy has no location set");
        }

        const coords = await geocodingService.geocodeVacancy(
          orgId,
          vacancyId,
          vacancy.location
        );

        if (!coords) {
          return c.json({ error: "Could not geocode location" }, 422);
        }

        return c.json(coords);
      } catch (err) {
        return errorResponse(c, err as Error);
      }
    }
  )

  /**
   * GET /distance/:candidateId/:vacancyId
   * Get distance between a candidate and vacancy.
   */
  .get(
    "/distance/:candidateId/:vacancyId",
    requirePermission("candidate", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const candidateId = c.req.param("candidateId");
        const vacancyId = c.req.param("vacancyId");

        const distanceKm = await geocodingService.getDistanceForCandidate(
          orgId,
          candidateId,
          vacancyId
        );

        return c.json({ distanceKm });
      } catch (err) {
        return errorResponse(c, err as Error);
      }
    }
  );
