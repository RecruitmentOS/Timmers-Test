import { Hono } from "hono";
import { z } from "zod";
import { publicVacancyService } from "../services/public-vacancy.service.js";
import { applyService } from "../services/apply.service.js";
import { distributionService } from "../services/distribution.service.js";
import { fileService } from "../services/file.service.js";
import { vacancyService } from "../services/vacancy.service.js";

const publicApplySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  city: z.string().optional(),
  cvFileId: z.string().uuid().optional(),
  licenseTypes: z.array(z.string()).optional(),
  hasCode95: z.boolean().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export const publicRoutes = new Hono();

/**
 * GET /public/:slug/jobs — List active vacancies for an organization
 */
publicRoutes.get("/public/:slug/jobs", async (c) => {
  const slug = c.req.param("slug");
  const org = await publicVacancyService.resolveOrgBySlug(slug);
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const vacanciesList = await publicVacancyService.getActiveVacancies(org.id);

  // Enrich with org info
  const enriched = vacanciesList.map((v) => ({
    ...v,
    organizationName: org.name,
    organizationLogo: org.logo,
  }));

  return c.json(enriched);
});

/**
 * GET /public/:slug/jobs/:vacancySlug — Get single vacancy detail
 */
publicRoutes.get("/public/:slug/jobs/:vacancySlug", async (c) => {
  const slug = c.req.param("slug");
  const vacancySlug = c.req.param("vacancySlug");

  const org = await publicVacancyService.resolveOrgBySlug(slug);
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const vacancy = await publicVacancyService.getVacancyBySlug(
    org.id,
    vacancySlug
  );
  if (!vacancy) {
    return c.json({ error: "Vacancy not found" }, 404);
  }

  return c.json({
    ...vacancy,
    organizationName: org.name,
    organizationLogo: org.logo,
  });
});

/**
 * POST /public/:slug/apply/:vacancySlug — Submit application from public form
 */
publicRoutes.post("/public/:slug/apply/:vacancySlug", async (c) => {
  const slug = c.req.param("slug");
  const vacancySlug = c.req.param("vacancySlug");

  const org = await publicVacancyService.resolveOrgBySlug(slug);
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  // Find the vacancy by slug to get vacancyId and ownerId
  const vacancy = await publicVacancyService.getVacancyBySlug(
    org.id,
    vacancySlug
  );
  if (!vacancy) {
    return c.json({ error: "Vacancy not found" }, 404);
  }

  // Get full vacancy record for ownerId
  const fullVacancy = await vacancyService.getById(org.id, vacancy.id);
  if (!fullVacancy) {
    return c.json({ error: "Vacancy not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = publicApplySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.issues }, 400);
  }

  const result = await applyService.submitApplication(
    org.id,
    vacancy.id,
    parsed.data,
    fullVacancy.ownerId
  );

  return c.json(result, 201);
});

/**
 * GET /public/:slug/upload-url — Get presigned upload URL (no auth required)
 * Query params: filename, contentType
 *
 * Returns only the presigned URL and S3 key. File metadata is NOT recorded
 * here because the fileMetadata.uploadedBy column has a FK to user.id and
 * there is no authenticated user. The apply service links the file after
 * the application is created.
 */
publicRoutes.get("/public/:slug/upload-url", async (c) => {
  const slug = c.req.param("slug");
  const filename = c.req.query("filename");
  const contentType = c.req.query("contentType");

  if (!filename || !contentType) {
    return c.json({ error: "filename and contentType are required" }, 400);
  }

  const org = await publicVacancyService.resolveOrgBySlug(slug);
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  // Use "pending" prefix — cleaned up when application is linked
  const pendingId = crypto.randomUUID();
  const { url, key } = await fileService.getUploadUrl(
    org.id,
    "candidates",
    `pending/${pendingId}`,
    filename,
    contentType
  );

  return c.json({ uploadUrl: url, key });
});

/**
 * GET /public/:slug/feed/indeed.xml — Indeed XML feed
 */
publicRoutes.get("/public/:slug/feed/indeed.xml", async (c) => {
  const slug = c.req.param("slug");
  const org = await publicVacancyService.resolveOrgBySlug(slug);
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const xml = await distributionService.generateIndeedXml(
    org.id,
    org.name,
    org.slug || slug
  );

  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});

/**
 * GET /public/:slug/feed/marktplaats.csv — Marktplaats CSV export
 */
publicRoutes.get("/public/:slug/feed/marktplaats.csv", async (c) => {
  const slug = c.req.param("slug");
  const org = await publicVacancyService.resolveOrgBySlug(slug);
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const csv = await distributionService.generateMarktplaatsCsv(
    org.id,
    org.slug || slug
  );

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="${slug}-vacatures.csv"`
  );
  return c.body(csv);
});
