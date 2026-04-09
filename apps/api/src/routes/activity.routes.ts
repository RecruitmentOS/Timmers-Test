import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { activityService } from "../services/activity.service.js";
import { errorResponse } from "../lib/errors.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { member } from "../db/schema/auth.js";
import { user } from "../db/schema/auth.js";
import { eq } from "drizzle-orm";

const activityQuerySchema = z.object({
  vacancyId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const activityRoutes = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission("activity", "read"),
    zValidator("query", activityQuerySchema),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const q = c.req.valid("query");
        const result = await activityService.listActivity(
          orgId,
          q.vacancyId,
          q.limit ?? 20,
          q.cursor
        );
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    }
  )

  /**
   * GET /api/activity/users — returns org members for @mention picker (D-06).
   * Returns {id, name, image} for all active members in the current org.
   */
  .get("/users", requirePermission("activity", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const users = await withTenantContext(orgId, async (tx) => {
        return tx
          .select({
            id: user.id,
            name: user.name,
            image: user.image,
          })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(eq(member.organizationId, orgId));
      });
      return c.json(users);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
