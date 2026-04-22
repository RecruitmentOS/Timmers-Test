// apps/api/src/routes/intake-template.routes.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import { intakeTemplates } from "../db/schema/index.js";
import { errorResponse } from "../lib/errors.js";

const templateSchema = z.object({
  variant: z.enum(["first_contact", "reminder_24h", "reminder_72h", "no_response_farewell"]),
  locale: z.string().default("nl"),
  name: z.string().min(1),
  body: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const intakeTemplateRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("settings", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const rows = await db
        .select()
        .from(intakeTemplates)
        .where(eq(intakeTemplates.organizationId, orgId));
      return c.json({ templates: rows });
    } catch (e) { return errorResponse(c, e as Error); }
  })
  .put("/:id", requirePermission("settings", "update"),
    zValidator("json", templateSchema.partial()),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const patch = c.req.valid("json");
        await db
          .update(intakeTemplates)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(intakeTemplates.id, id), eq(intakeTemplates.organizationId, orgId)));
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  );
