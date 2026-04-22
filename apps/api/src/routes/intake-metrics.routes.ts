// apps/api/src/routes/intake-metrics.routes.ts
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import { errorResponse } from "../lib/errors.js";

export const intakeMetricsRoutes = new Hono<AppEnv>()
  .get("/summary", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const [row] = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE state = 'in_progress') as active,
          COUNT(*) FILTER (WHERE state = 'awaiting_human') as awaiting_human,
          COUNT(*) FILTER (WHERE state = 'completed' AND verdict = 'qualified') as qualified,
          COUNT(*) FILTER (WHERE state = 'completed' AND verdict = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE state = 'completed' AND verdict = 'unsure') as unsure,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
        FROM intake_sessions
        WHERE organization_id = ${orgId}
      `);
      return c.json(row);
    } catch (e) { return errorResponse(c, e as Error); }
  });
