import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { Context } from "hono";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { reportService, toCSV } from "../services/report.service.js";
import type { AppRole } from "@recruitment-os/permissions";
import { errorResponse } from "../lib/errors.js";
import type { ReportParams, ReportName } from "@recruitment-os/types";

/**
 * Role read from session user — same helper as dashboard.routes.ts.
 */
function getRole(c: Context<AppEnv>): AppRole {
  const u = c.get("user");
  return (u?.role ?? "recruiter") as AppRole;
}

function parseParams(c: Context<AppEnv>): ReportParams {
  const startDate = c.req.query("startDate") ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const endDate = c.req.query("endDate") ?? new Date().toISOString();
  const vacancyId = c.req.query("vacancyId") || undefined;
  return { startDate, endDate, vacancyId };
}

type ReportHandler = (
  orgId: string,
  params: ReportParams,
  role: AppRole,
  userId: string
) => Promise<unknown>;

const reportHandlers: Record<ReportName, ReportHandler> = {
  "total-candidates": reportService.totalCandidates,
  "qualified-candidates": reportService.qualifiedCandidates,
  "stage-funnel": reportService.stageFunnel,
  "time-to-first-contact": reportService.timeToFirstContact,
  "source-breakdown": reportService.sourceBreakdown,
  "owner-activity": reportService.ownerActivity,
};

/** Map report name to CSV headers + row key extraction */
const csvHeaders: Record<ReportName, string[]> = {
  "total-candidates": ["vacancyId", "vacancyTitle", "total"],
  "qualified-candidates": ["vacancyId", "vacancyTitle", "qualified", "maybe", "rejected"],
  "stage-funnel": ["vacancyId", "vacancyTitle", "stageName", "count", "conversionRate"],
  "time-to-first-contact": ["vacancyId", "vacancyTitle", "avgHours", "medianHours"],
  "source-breakdown": ["source", "count", "percentage"],
  "owner-activity": ["userId", "userName", "candidatesProcessed", "tasksCompleted", "qualificationsGiven"],
};

function flattenForCSV(name: ReportName, data: unknown): Record<string, unknown>[] {
  if (name === "source-breakdown") {
    return (data as { entries: Record<string, unknown>[] }).entries;
  }
  if (name === "stage-funnel") {
    // Flatten nested stages arrays
    const reports = data as Array<{ vacancyId: string; vacancyTitle: string; stages: Array<Record<string, unknown>> }>;
    const rows: Record<string, unknown>[] = [];
    for (const r of reports) {
      for (const stage of r.stages) {
        rows.push({ vacancyId: r.vacancyId, vacancyTitle: r.vacancyTitle, ...stage });
      }
    }
    return rows;
  }
  return data as Record<string, unknown>[];
}

const VALID_NAMES = new Set<string>(Object.keys(reportHandlers));

/**
 * Report routes — JSON + CSV endpoints for all 6 report types.
 *
 * GET /api/reports/:name        — JSON response
 * GET /api/reports/:name.csv    — streaming CSV response
 */
export const reportRoutes = new Hono<AppEnv>()
  .get("/:name.csv", requirePermission("report", "read"), async (c) => {
    try {
      const rawName = c.req.param("name");
      if (!VALID_NAMES.has(rawName)) {
        return c.json({ error: `Unknown report: ${rawName}` }, 400);
      }
      const name = rawName as ReportName;
      const orgId = c.get("organizationId");
      const usr = c.get("user")!;
      const params = parseParams(c);

      const handler = reportHandlers[name];
      const data = await handler(orgId, params, getRole(c), usr.id);
      const rows = flattenForCSV(name, data);
      const headers = csvHeaders[name];
      const dateStr = new Date().toISOString().slice(0, 10);

      c.header("Content-Type", "text/csv; charset=utf-8");
      c.header("Content-Disposition", `attachment; filename="${name}-${dateStr}.csv"`);

      return stream(c, async (s) => {
        for await (const chunk of toCSV(headers, rows)) {
          await s.write(chunk);
        }
      });
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  })
  .get("/:name", requirePermission("report", "read"), async (c) => {
    try {
      const rawName = c.req.param("name");
      if (!VALID_NAMES.has(rawName)) {
        return c.json({ error: `Unknown report: ${rawName}` }, 400);
      }
      const name = rawName as ReportName;
      const orgId = c.get("organizationId");
      const usr = c.get("user")!;
      const params = parseParams(c);

      const handler = reportHandlers[name];
      const data = await handler(orgId, params, getRole(c), usr.id);
      return c.json(data);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  });
