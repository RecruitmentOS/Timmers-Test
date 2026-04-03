import { createMiddleware } from "hono/factory";
import { canPerform, type Resource } from "@recruitment-os/permissions";

export function requirePermission(resource: Resource, action: string) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user") as any;
    const role = user?.role;
    if (!role || !canPerform(role, resource, action)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

export function requireRole(...roles: string[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get("user") as any;
    if (!user?.role || !roles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
