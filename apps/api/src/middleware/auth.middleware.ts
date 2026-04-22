import { createMiddleware } from "hono/factory";
import { eq, and } from "drizzle-orm";
import { auth } from "../auth.js";
import { db } from "../db/index.js";
import { member } from "../db/schema/auth.js";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Enrich user with role from the active organization's member row.
  // Better Auth's default session.user has no `role` field — role lives
  // on the per-org `member` table. RBAC middleware reads `user.role`,
  // so hydrate it here.
  const activeOrgId = (session.session as { activeOrganizationId?: string })
    .activeOrganizationId;
  let role: string | undefined;
  if (activeOrgId) {
    const [row] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, activeOrgId)
        )
      )
      .limit(1);
    role = row?.role ?? undefined;
  }

  c.set("user", { ...session.user, role });
  c.set("session", session.session);
  await next();
});
