"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  OpenVacanciesWidget,
  NewCandidatesWidget,
  OverdueFollowupsWidget,
  QualifiedThisWeekWidget,
  OpenTasksWidget,
  SourceSnapshotWidget,
} from "@recruitment-os/types";

/**
 * Dashboard widget hooks — EXACTLY ONE useQuery per widget.
 *
 * Decision D-13 (02-CONTEXT.md): six independent GET endpoints, six
 * independent hooks. Do NOT merge into a batched useDashboard() hook
 * — each widget has its own cache key, its own staleTime, and its
 * own failure mode so that a slow query on one widget cannot hold
 * the entire dashboard hostage.
 *
 * Endpoints are hyphenated (/overdue-follow-ups, /qualified-this-week,
 * /source-snapshot) — they must match the Hono routes exactly.
 *
 * staleTime is 30s across the board: the dashboard is a glanceable
 * surface, not a live feed. Mutation hooks in use-tasks/use-applications
 * already invalidate ["dashboard"] on success.
 */

const STALE = 30_000;

export function useOpenVacanciesWidget() {
  return useQuery<OpenVacanciesWidget>({
    queryKey: ["dashboard", "open-vacancies"],
    queryFn: () => apiClient<OpenVacanciesWidget>("/api/dashboard/open-vacancies"),
    staleTime: STALE,
  });
}

export function useNewCandidatesWidget() {
  return useQuery<NewCandidatesWidget>({
    queryKey: ["dashboard", "new-candidates"],
    queryFn: () => apiClient<NewCandidatesWidget>("/api/dashboard/new-candidates"),
    staleTime: STALE,
  });
}

export function useOverdueFollowUpsWidget() {
  return useQuery<OverdueFollowupsWidget>({
    queryKey: ["dashboard", "overdue-follow-ups"],
    queryFn: () =>
      apiClient<OverdueFollowupsWidget>("/api/dashboard/overdue-follow-ups"),
    staleTime: STALE,
  });
}

export function useQualifiedThisWeekWidget() {
  return useQuery<QualifiedThisWeekWidget>({
    queryKey: ["dashboard", "qualified-this-week"],
    queryFn: () =>
      apiClient<QualifiedThisWeekWidget>("/api/dashboard/qualified-this-week"),
    staleTime: STALE,
  });
}

export function useOpenTasksWidget() {
  return useQuery<OpenTasksWidget>({
    queryKey: ["dashboard", "open-tasks"],
    queryFn: () => apiClient<OpenTasksWidget>("/api/dashboard/open-tasks"),
    staleTime: STALE,
  });
}

export function useSourceSnapshotWidget() {
  return useQuery<SourceSnapshotWidget>({
    queryKey: ["dashboard", "source-snapshot"],
    queryFn: () =>
      apiClient<SourceSnapshotWidget>("/api/dashboard/source-snapshot"),
    staleTime: STALE,
  });
}
