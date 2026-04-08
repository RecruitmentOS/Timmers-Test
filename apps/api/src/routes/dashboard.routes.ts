import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { dashboardService } from "../services/dashboard.service.js";
import type { AppRole } from "@recruitment-os/permissions";
import { errorResponse } from "../lib/errors.js";

/**
 * Role read from session user.
 *
 * CRITICAL: Phase 1 auth.middleware sets c.set("user", session.user) and
 * role lives on the user object. There is NO c.get for a separate userRole
 * key — reading that key returns undefined and silently drops every user
 * into the "recruiter" fallback, breaking DASH-02 role scoping for
 * agents and admins. This helper MUST read c.get("user").role.
 */
function getRole(c: Context<AppEnv>): AppRole {
  const u = c.get("user");
  return (u?.role ?? "recruiter") as AppRole;
}

/**
 * Six separate dashboard GET endpoints — one per widget.
 * Locked decision (02-CONTEXT.md D-13); do not merge into a single
 * batched endpoint unless individual queries exceed 200ms p95.
 *
 * Each handler returns the service result DIRECTLY via c.json(await ...).
 * Do NOT wrap in { count } or { entries }. The rich widget shapes
 * (total / byStatus / byOwner / byDay / overdue / bySource) live in
 * @recruitment-os/types and ARE the wire contract.
 */
export const dashboardRoutes = new Hono<AppEnv>()
  .get("/open-vacancies", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      return c.json(await dashboardService.getOpenVacancies(orgId, user.id, getRole(c)));
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get("/new-candidates", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      return c.json(await dashboardService.getNewCandidatesToday(orgId, user.id, getRole(c)));
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get("/overdue-follow-ups", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      return c.json(await dashboardService.getOverdueFollowUps(orgId, user.id, getRole(c)));
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get("/qualified-this-week", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      return c.json(await dashboardService.getQualifiedThisWeek(orgId, user.id, getRole(c)));
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get("/open-tasks", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      return c.json(await dashboardService.getOpenTasks(orgId, user.id, getRole(c)));
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })

  .get("/source-snapshot", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const user = c.get("user")!;
      return c.json(await dashboardService.getSourceSnapshot(orgId, user.id, getRole(c)));
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
