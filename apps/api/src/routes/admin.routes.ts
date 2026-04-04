import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { pipelineStages } from "../db/schema/index.js";
import { errorResponse } from "../lib/errors.js";

export const adminRoutes = new Hono<AppEnv>()
  .get(
    "/pipeline-stages",
    requirePermission("settings", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const result = await withTenantContext(orgId, async (tx) => {
          return tx
            .select()
            .from(pipelineStages)
            .orderBy(sql`${pipelineStages.sortOrder} ASC`);
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  );
