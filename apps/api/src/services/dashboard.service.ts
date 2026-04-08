import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  vacancies,
  candidates,
  candidateApplications,
  tasks,
  user,
} from "../db/schema/index.js";
import type { AppRole } from "@recruitment-os/permissions";
import type {
  OpenVacanciesWidget,
  NewCandidatesWidget,
  OverdueFollowupsWidget,
  QualifiedThisWeekWidget,
  OpenTasksWidget,
  SourceSnapshotWidget,
} from "@recruitment-os/types";

/**
 * Dashboard service — six widget query methods, one per endpoint.
 *
 * Role-scoping rule (DASH-02):
 * - agent: ONLY data explicitly assigned to them (assigned_agent_id on
 *   candidate_applications, assigned_to_user_id on tasks)
 * - recruiter: applications/tasks they own (owner_id / assigned_to_user_id),
 *   plus org-wide vacancy/source widgets where ownership is not applicable
 * - admin / super_admin / agency_admin: always org-wide
 * - hiring_manager / client_viewer: org-wide read (portal shaping in Phase 3)
 * - marketing_op: org-wide
 *
 * Every method returns a RICH widget shape from @recruitment-os/types
 * (total + breakdown) so the frontend can render sparklines / lists /
 * pills / bar charts without additional fetches.
 *
 * Performance budget: <200ms p95 per endpoint (02-CONTEXT.md D-13).
 * If any widget exceeds this, swap to a server-side aggregate table.
 */
function isAgent(role: AppRole): boolean {
  return role === "agent";
}
function isRecruiter(role: AppRole): boolean {
  return role === "recruiter";
}

export const dashboardService = {
  /**
   * Widget 1: Open vacancies — active count + byStatus breakdown pills.
   * Agents only see vacancies they're assigned to via candidate_applications.
   */
  async getOpenVacancies(
    orgId: string,
    userId: string,
    role: AppRole
  ): Promise<OpenVacanciesWidget> {
    return withTenantContext(orgId, async (tx) => {
      const scope = isAgent(role)
        ? sql`${vacancies.id} IN (SELECT DISTINCT vacancy_id FROM candidate_applications WHERE assigned_agent_id = ${userId})`
        : sql`true`;

      const rows = await tx
        .select({
          status: vacancies.status,
          count: sql<number>`count(*)::int`,
        })
        .from(vacancies)
        .where(scope)
        .groupBy(vacancies.status);

      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        byStatus[r.status] = Number(r.count);
        if (r.status === "active") total += Number(r.count);
      }
      return { total, byStatus };
    });
  },

  /**
   * Widget 2: New candidates today + day-over-day delta trend.
   * Agents/recruiters are scoped to candidates linked to applications
   * they own / are assigned to.
   */
  async getNewCandidatesToday(
    orgId: string,
    userId: string,
    role: AppRole
  ): Promise<NewCandidatesWidget> {
    return withTenantContext(orgId, async (tx) => {
      const scopeClause = isAgent(role)
        ? sql` AND ${candidates.id} IN (SELECT candidate_id FROM candidate_applications WHERE assigned_agent_id = ${userId})`
        : isRecruiter(role)
          ? sql` AND ${candidates.id} IN (SELECT candidate_id FROM candidate_applications WHERE owner_id = ${userId})`
          : sql``;

      const [todayRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(candidates)
        .where(
          sql`${candidates.createdAt} >= current_date${scopeClause}`
        );

      const [yesterdayRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(candidates)
        .where(
          sql`${candidates.createdAt} >= current_date - interval '1 day' AND ${candidates.createdAt} < current_date${scopeClause}`
        );

      const today = Number(todayRow?.count ?? 0);
      const yesterday = Number(yesterdayRow?.count ?? 0);
      return { today, delta: today - yesterday };
    });
  },

  /**
   * Widget 3: Overdue follow-ups + "who is behind" per-owner list.
   * Agents/recruiters are scoped to their own assigned tasks.
   */
  async getOverdueFollowUps(
    orgId: string,
    userId: string,
    role: AppRole
  ): Promise<OverdueFollowupsWidget> {
    return withTenantContext(orgId, async (tx) => {
      const scope =
        isAgent(role) || isRecruiter(role)
          ? eq(tasks.assignedToUserId, userId)
          : sql`true`;

      const rows = await tx
        .select({
          ownerId: tasks.assignedToUserId,
          ownerName: user.name,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .leftJoin(user, eq(tasks.assignedToUserId, user.id))
        .where(
          and(
            eq(tasks.status, "open"),
            sql`${tasks.dueDate} < now()`,
            scope
          )
        )
        .groupBy(tasks.assignedToUserId, user.name);

      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      return {
        total,
        byOwner: rows.map((r) => ({
          ownerId: r.ownerId,
          ownerName: r.ownerName ?? "Unknown",
          count: Number(r.count),
        })),
      };
    });
  },

  /**
   * Widget 4: Qualified this week + per-day sparkline values.
   * Week starts Monday (date_trunc('week', ...)).
   * Agents/recruiters are scoped to their own assigned/owned applications.
   */
  async getQualifiedThisWeek(
    orgId: string,
    userId: string,
    role: AppRole
  ): Promise<QualifiedThisWeekWidget> {
    return withTenantContext(orgId, async (tx) => {
      const scope = isAgent(role)
        ? eq(candidateApplications.assignedAgentId, userId)
        : isRecruiter(role)
          ? eq(candidateApplications.ownerId, userId)
          : sql`true`;

      const rows = await tx
        .select({
          day: sql<string>`to_char(date_trunc('day', ${candidateApplications.updatedAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(candidateApplications)
        .where(
          and(
            eq(candidateApplications.qualificationStatus, "yes"),
            sql`${candidateApplications.updatedAt} >= date_trunc('week', now())`,
            scope
          )
        )
        .groupBy(sql`date_trunc('day', ${candidateApplications.updatedAt})`)
        .orderBy(sql`date_trunc('day', ${candidateApplications.updatedAt}) ASC`);

      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      return {
        total,
        byDay: rows.map((r) => ({ day: r.day, count: Number(r.count) })),
      };
    });
  },

  /**
   * Widget 5: Open tasks + overdue sub-count as red badge.
   * Agents/recruiters scoped to their own assigned tasks.
   */
  async getOpenTasks(
    orgId: string,
    userId: string,
    role: AppRole
  ): Promise<OpenTasksWidget> {
    return withTenantContext(orgId, async (tx) => {
      const scope =
        isAgent(role) || isRecruiter(role)
          ? eq(tasks.assignedToUserId, userId)
          : sql`true`;

      const [row] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          overdue: sql<number>`count(*) FILTER (WHERE ${tasks.dueDate} < now())::int`,
        })
        .from(tasks)
        .where(and(eq(tasks.status, "open"), scope));

      return {
        total: Number(row?.total ?? 0),
        overdue: Number(row?.overdue ?? 0),
      };
    });
  },

  /**
   * Widget 6: Source snapshot — last 30 days bySource with percentage.
   * Agents/recruiters scoped to candidates linked to their applications.
   */
  async getSourceSnapshot(
    orgId: string,
    userId: string,
    role: AppRole
  ): Promise<SourceSnapshotWidget> {
    return withTenantContext(orgId, async (tx) => {
      const scopeClause = isAgent(role)
        ? sql` AND ${candidates.id} IN (SELECT candidate_id FROM candidate_applications WHERE assigned_agent_id = ${userId})`
        : isRecruiter(role)
          ? sql` AND ${candidates.id} IN (SELECT candidate_id FROM candidate_applications WHERE owner_id = ${userId})`
          : sql``;

      const rows = await tx
        .select({
          source: candidates.source,
          count: sql<number>`count(*)::int`,
        })
        .from(candidates)
        .where(
          sql`${candidates.createdAt} >= now() - interval '30 days'${scopeClause}`
        )
        .groupBy(candidates.source);

      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      return {
        bySource: rows.map((r) => ({
          source: r.source ?? "unknown",
          count: Number(r.count),
          percentage:
            total === 0 ? 0 : Math.round((Number(r.count) / total) * 100),
        })),
      };
    });
  },
};
