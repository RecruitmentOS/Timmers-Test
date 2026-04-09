import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  vacancies,
  candidates,
  candidateApplications,
  applicationStageHistory,
  pipelineStages,
  activityLog,
  tasks,
  user,
} from "../db/schema/index.js";
import type { AppRole } from "@recruitment-os/permissions";
import type {
  ReportParams,
  TotalCandidatesReport,
  QualifiedCandidatesReport,
  StageFunnelReport,
  TimeToFirstContactReport,
  SourceBreakdownReport,
  OwnerActivityReport,
} from "@recruitment-os/types";

/**
 * Report service — 6 report methods + CSV helper.
 *
 * Role-scoping rule (mirrors dashboard pattern):
 * - agent: ONLY vacancies/applications assigned to them
 * - recruiter: applications/vacancies they own
 * - admin / super_admin / agency_admin / hiring_manager / client_viewer / marketing_op: org-wide
 *
 * Every method uses withTenantContext for RLS.
 */

function isAgent(role: AppRole): boolean {
  return role === "agent";
}
function isRecruiter(role: AppRole): boolean {
  return role === "recruiter";
}

/** Build vacancy-scope SQL fragment based on role */
function vacancyScope(role: AppRole, userId: string) {
  if (isAgent(role)) {
    return sql`${candidateApplications.vacancyId} IN (SELECT DISTINCT vacancy_id FROM candidate_applications WHERE assigned_agent_id = ${userId})`;
  }
  if (isRecruiter(role)) {
    return sql`${candidateApplications.vacancyId} IN (SELECT vacancy_id FROM vacancies WHERE owner_id = ${userId})`;
  }
  return sql`true`;
}

export const reportService = {
  /**
   * RPT-01: Total candidates per vacancy in date range.
   */
  async totalCandidates(
    orgId: string,
    params: ReportParams,
    role: AppRole,
    userId: string
  ): Promise<TotalCandidatesReport[]> {
    return withTenantContext(orgId, async (tx) => {
      const scope = vacancyScope(role, userId);
      const vacancyFilter = params.vacancyId
        ? sql`AND ${candidateApplications.vacancyId} = ${params.vacancyId}`
        : sql``;

      const rows = await tx
        .select({
          vacancyId: candidateApplications.vacancyId,
          vacancyTitle: vacancies.title,
          total: sql<number>`count(*)::int`,
        })
        .from(candidateApplications)
        .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
        .where(
          sql`${scope} AND ${candidateApplications.createdAt} >= ${params.startDate}::timestamptz AND ${candidateApplications.createdAt} <= ${params.endDate}::timestamptz ${vacancyFilter}`
        )
        .groupBy(candidateApplications.vacancyId, vacancies.title);

      return rows.map((r) => ({
        vacancyId: r.vacancyId,
        vacancyTitle: r.vacancyTitle,
        total: Number(r.total),
      }));
    });
  },

  /**
   * RPT-02: Qualified candidates per vacancy — grouped by qualification status.
   */
  async qualifiedCandidates(
    orgId: string,
    params: ReportParams,
    role: AppRole,
    userId: string
  ): Promise<QualifiedCandidatesReport[]> {
    return withTenantContext(orgId, async (tx) => {
      const scope = vacancyScope(role, userId);
      const vacancyFilter = params.vacancyId
        ? sql`AND ${candidateApplications.vacancyId} = ${params.vacancyId}`
        : sql``;

      const rows = await tx
        .select({
          vacancyId: candidateApplications.vacancyId,
          vacancyTitle: vacancies.title,
          status: candidateApplications.qualificationStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(candidateApplications)
        .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
        .where(
          sql`${scope} AND ${candidateApplications.createdAt} >= ${params.startDate}::timestamptz AND ${candidateApplications.createdAt} <= ${params.endDate}::timestamptz ${vacancyFilter}`
        )
        .groupBy(
          candidateApplications.vacancyId,
          vacancies.title,
          candidateApplications.qualificationStatus
        );

      // Group rows by vacancy
      const byVacancy = new Map<
        string,
        { vacancyTitle: string; qualified: number; maybe: number; rejected: number }
      >();

      for (const r of rows) {
        if (!byVacancy.has(r.vacancyId)) {
          byVacancy.set(r.vacancyId, {
            vacancyTitle: r.vacancyTitle,
            qualified: 0,
            maybe: 0,
            rejected: 0,
          });
        }
        const entry = byVacancy.get(r.vacancyId)!;
        const count = Number(r.count);
        if (r.status === "yes") entry.qualified += count;
        else if (r.status === "maybe") entry.maybe += count;
        else if (r.status === "no") entry.rejected += count;
      }

      return Array.from(byVacancy.entries()).map(([vacancyId, data]) => ({
        vacancyId,
        ...data,
      }));
    });
  },

  /**
   * RPT-03: Stage funnel — distinct applications per stage per vacancy.
   * Conversion rate = (count / previous stage count) * 100.
   */
  async stageFunnel(
    orgId: string,
    params: ReportParams,
    role: AppRole,
    userId: string
  ): Promise<StageFunnelReport[]> {
    return withTenantContext(orgId, async (tx) => {
      const scope = isAgent(role)
        ? sql`AND ash.application_id IN (SELECT id FROM candidate_applications WHERE assigned_agent_id = ${userId})`
        : isRecruiter(role)
          ? sql`AND ash.application_id IN (SELECT id FROM candidate_applications ca2 JOIN vacancies v2 ON ca2.vacancy_id = v2.id WHERE v2.owner_id = ${userId})`
          : sql``;
      const vacancyFilter = params.vacancyId
        ? sql`AND ca.vacancy_id = ${params.vacancyId}`
        : sql``;

      const rows = await tx.execute(sql`
        SELECT
          ca.vacancy_id AS "vacancyId",
          v.title AS "vacancyTitle",
          ps.id AS "stageId",
          ps.name AS "stageName",
          ps.sort_order AS "sortOrder",
          COUNT(DISTINCT ash.application_id)::int AS "count"
        FROM application_stage_history ash
        JOIN candidate_applications ca ON ash.application_id = ca.id
        JOIN vacancies v ON ca.vacancy_id = v.id
        JOIN pipeline_stages ps ON ash.to_stage_id = ps.id
        WHERE ash.created_at >= ${params.startDate}::timestamptz
          AND ash.created_at <= ${params.endDate}::timestamptz
          ${scope}
          ${vacancyFilter}
        GROUP BY ca.vacancy_id, v.title, ps.id, ps.name, ps.sort_order
        ORDER BY ca.vacancy_id, ps.sort_order ASC
      `);

      // Group by vacancy
      const byVacancy = new Map<
        string,
        { vacancyTitle: string; stages: Array<{ stageId: string; stageName: string; count: number; sortOrder: number }> }
      >();

      for (const r of rows as any[]) {
        if (!byVacancy.has(r.vacancyId)) {
          byVacancy.set(r.vacancyId, { vacancyTitle: r.vacancyTitle, stages: [] });
        }
        byVacancy.get(r.vacancyId)!.stages.push({
          stageId: r.stageId,
          stageName: r.stageName,
          count: Number(r.count),
          sortOrder: Number(r.sortOrder),
        });
      }

      return Array.from(byVacancy.entries()).map(([vacancyId, data]) => {
        const sorted = data.stages.sort((a, b) => a.sortOrder - b.sortOrder);
        let prevCount = sorted[0]?.count ?? 0;
        const stages = sorted.map((s, i) => {
          const conversionRate = i === 0 ? 100 : prevCount > 0 ? Math.round((s.count / prevCount) * 100) : 0;
          prevCount = s.count;
          return {
            stageId: s.stageId,
            stageName: s.stageName,
            count: s.count,
            conversionRate,
          };
        });
        return { vacancyId, vacancyTitle: data.vacancyTitle, stages };
      });
    });
  },

  /**
   * RPT-04: Time to first contact — AVG and MEDIAN hours per vacancy.
   * First contact = first stage_event (earliest application_stage_history row) per application.
   */
  async timeToFirstContact(
    orgId: string,
    params: ReportParams,
    role: AppRole,
    userId: string
  ): Promise<TimeToFirstContactReport[]> {
    return withTenantContext(orgId, async (tx) => {
      const scope = isAgent(role)
        ? sql`AND ca.assigned_agent_id = ${userId}`
        : isRecruiter(role)
          ? sql`AND v.owner_id = ${userId}`
          : sql``;
      const vacancyFilter = params.vacancyId
        ? sql`AND ca.vacancy_id = ${params.vacancyId}`
        : sql``;

      const rows = await tx.execute(sql`
        WITH first_contact AS (
          SELECT
            ash.application_id,
            MIN(ash.created_at) AS first_contact_at
          FROM application_stage_history ash
          GROUP BY ash.application_id
        )
        SELECT
          ca.vacancy_id AS "vacancyId",
          v.title AS "vacancyTitle",
          ROUND(AVG(EXTRACT(EPOCH FROM (fc.first_contact_at - ca.created_at)) / 3600)::numeric, 1) AS "avgHours",
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fc.first_contact_at - ca.created_at)) / 3600)::numeric, 1) AS "medianHours"
        FROM candidate_applications ca
        JOIN vacancies v ON ca.vacancy_id = v.id
        JOIN first_contact fc ON fc.application_id = ca.id
        WHERE ca.created_at >= ${params.startDate}::timestamptz
          AND ca.created_at <= ${params.endDate}::timestamptz
          ${scope}
          ${vacancyFilter}
        GROUP BY ca.vacancy_id, v.title
      `);

      return (rows as any[]).map((r) => ({
        vacancyId: r.vacancyId,
        vacancyTitle: r.vacancyTitle,
        avgHours: Number(r.avgHours ?? 0),
        medianHours: Number(r.medianHours ?? 0),
      }));
    });
  },

  /**
   * RPT-05: Source breakdown — candidates grouped by source field.
   */
  async sourceBreakdown(
    orgId: string,
    params: ReportParams,
    role: AppRole,
    userId: string
  ): Promise<SourceBreakdownReport> {
    return withTenantContext(orgId, async (tx) => {
      const scopeClause = isAgent(role)
        ? sql` AND ${candidates.id} IN (SELECT candidate_id FROM candidate_applications WHERE assigned_agent_id = ${userId})`
        : isRecruiter(role)
          ? sql` AND ${candidates.id} IN (SELECT candidate_id FROM candidate_applications ca2 JOIN vacancies v2 ON ca2.vacancy_id = v2.id WHERE v2.owner_id = ${userId})`
          : sql``;

      const rows = await tx
        .select({
          source: candidates.source,
          count: sql<number>`count(*)::int`,
        })
        .from(candidates)
        .where(
          sql`${candidates.createdAt} >= ${params.startDate}::timestamptz AND ${candidates.createdAt} <= ${params.endDate}::timestamptz${scopeClause}`
        )
        .groupBy(candidates.source);

      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      return {
        entries: rows.map((r) => ({
          source: r.source ?? "unknown",
          count: Number(r.count),
          percentage: total === 0 ? 0 : Math.round((Number(r.count) / total) * 100),
        })),
      };
    });
  },

  /**
   * RPT-06: Owner activity — events from activity_log grouped by actor.
   */
  async ownerActivity(
    orgId: string,
    params: ReportParams,
    role: AppRole,
    userId: string
  ): Promise<OwnerActivityReport[]> {
    return withTenantContext(orgId, async (tx) => {
      const scope = isAgent(role) || isRecruiter(role)
        ? sql`AND ${activityLog.actorId} = ${userId}`
        : sql``;

      const rows = await tx.execute(sql`
        SELECT
          al.actor_id AS "userId",
          u.name AS "userName",
          COUNT(*) FILTER (WHERE al.action IN ('stage_changed', 'application_created'))::int AS "candidatesProcessed",
          COUNT(*) FILTER (WHERE al.action = 'task_completed')::int AS "tasksCompleted",
          COUNT(*) FILTER (WHERE al.action = 'qualified')::int AS "qualificationsGiven"
        FROM activity_log al
        JOIN "user" u ON al.actor_id = u.id
        WHERE al.created_at >= ${params.startDate}::timestamptz
          AND al.created_at <= ${params.endDate}::timestamptz
          ${scope}
        GROUP BY al.actor_id, u.name
        ORDER BY "candidatesProcessed" DESC
      `);

      return (rows as any[]).map((r) => ({
        userId: r.userId,
        userName: r.userName ?? "Unknown",
        candidatesProcessed: Number(r.candidatesProcessed ?? 0),
        tasksCompleted: Number(r.tasksCompleted ?? 0),
        qualificationsGiven: Number(r.qualificationsGiven ?? 0),
      }));
    });
  },
};

/**
 * CSV helper — converts headers + rows into CSV string with UTF-8 BOM for Excel.
 * Returns an async generator that yields lines incrementally for streaming.
 */
export async function* toCSV(
  headers: string[],
  rows: Record<string, unknown>[]
): AsyncGenerator<string> {
  // UTF-8 BOM for Excel compatibility
  yield "\uFEFF";
  yield headers.map(quoteField).join(",") + "\n";
  for (const row of rows) {
    yield headers.map((h) => quoteField(String(row[h] ?? ""))).join(",") + "\n";
  }
}

function quoteField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
