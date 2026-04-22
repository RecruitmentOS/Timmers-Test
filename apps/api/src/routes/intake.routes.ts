// apps/api/src/routes/intake.routes.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import { vacancies } from "../db/schema/index.js";
import { suggestCriteria } from "../modules/intake/criteria/suggest.service.js";
import { errorResponse } from "../lib/errors.js";
import { qualificationCriteriaSchema } from "@recruitment-os/types";

export const intakeRoutes = new Hono<AppEnv>()
  .post(
    "/criteria/suggest",
    requirePermission("vacancy", "update"),
    zValidator("json", z.object({ vacancyId: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { vacancyId } = c.req.valid("json");
        const [vac] = await db
          .select({
            title: vacancies.title,
            description: vacancies.description,
            criteria: vacancies.qualificationCriteria,
          })
          .from(vacancies)
          .where(
            and(eq(vacancies.id, vacancyId), eq(vacancies.organizationId, orgId)),
          )
          .limit(1);
        if (!vac) return c.json({ error: "vacancy not found" }, 404);
        const parsed = qualificationCriteriaSchema.parse(vac.criteria ?? { mustHave: {}, niceToHave: {} });
        const result = await suggestCriteria({
          vacancyTitle: vac.title,
          vacancyDescription: vac.description ?? null,
          currentCriteria: parsed,
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    },
  );
