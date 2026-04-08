/**
 * Phase 2 dashboard widget response shapes.
 *
 * These are RICH shapes — each widget returns not just a headline
 * number but also a breakdown (by status, by owner, by day, by source, etc.)
 * so the frontend can render sparklines, lists, and secondary stats without
 * firing additional requests.
 *
 * Plan 02-02 (backend services) returns these exact shapes.
 * Plan 02-04 (frontend) imports these types to render each widget.
 * Do NOT diverge — the frontend reads the nested fields directly.
 */

/**
 * Widget 1: Open vacancies.
 * `total` is the headline number; `byStatus` is a small breakdown
 * (draft / active / paused / closed) so the widget can show a status pill row.
 */
export interface OpenVacanciesWidget {
  total: number;
  byStatus: Record<string, number>;
}

/**
 * Widget 2: New candidates today.
 * `today` is the headline; `delta` is (today - yesterday) so the
 * widget can render a +/- trend indicator.
 */
export interface NewCandidatesWidget {
  today: number;
  /** today - yesterday */
  delta: number;
}

/**
 * Widget 3: Overdue follow-ups.
 * `total` is the headline; `byOwner` powers a "who is behind" list
 * with clickable owners.
 */
export interface OverdueFollowupsWidget {
  total: number;
  byOwner: Array<{
    ownerId: string;
    ownerName: string;
    count: number;
  }>;
}

/**
 * Widget 4: Qualified this week.
 * `total` is the headline; `byDay` gives the sparkline values.
 * `day` is an ISO date string (YYYY-MM-DD).
 */
export interface QualifiedThisWeekWidget {
  total: number;
  byDay: Array<{
    /** ISO date YYYY-MM-DD */
    day: string;
    count: number;
  }>;
}

/**
 * Widget 5: Open tasks.
 * `total` is the headline; `overdue` is a sub-count shown as a red badge.
 */
export interface OpenTasksWidget {
  total: number;
  overdue: number;
}

/**
 * Widget 6: Source snapshot.
 * `bySource` is a list of sources with count and percentage share
 * so the frontend can render a bar chart without extra math.
 */
export interface SourceSnapshotWidget {
  bySource: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
}
