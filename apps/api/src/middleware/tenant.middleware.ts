import { createMiddleware } from "hono/factory";

export const tenantMiddleware = createMiddleware(async (c, next) => {
  const session = c.get("session") as any;
  const orgId = session?.activeOrganizationId;
  if (!orgId) {
    return c.json(
      { error: "No active organization. Call organization.setActive() first." },
      403
    );
  }
  c.set("organizationId", orgId);
  await next();
});
