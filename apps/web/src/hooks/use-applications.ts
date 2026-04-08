"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  CandidateApplication,
  CandidateApplicationListResponse,
  CreateApplicationInput,
} from "@recruitment-os/types";

/**
 * Paginated listing of applications with server-side filters.
 *
 * Reads the Plan 02-02 envelope `{ rows, total, pages, page, limit }`
 * from GET /api/applications. The `total` field powers the
 * SelectAllMatchingBanner in Plan 02-04 (bulk-by-filter UI).
 *
 * Consumers read `data?.rows` for the current page and `data?.total`
 * for the full filtered count.
 */
export type UseApplicationsFilters = {
  vacancyId?: string;
  stageId?: string;
  ownerId?: string;
  source?: string;
  qualificationStatus?: "pending" | "yes" | "maybe" | "no";
  page?: number;
  limit?: number;
};

export function useApplications(filters: UseApplicationsFilters = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") {
      qs.set(k, String(v));
    }
  }
  const qsString = qs.toString();
  return useQuery<CandidateApplicationListResponse>({
    queryKey: ["applications", filters],
    queryFn: () =>
      apiClient<CandidateApplicationListResponse>(
        `/api/applications${qsString ? `?${qsString}` : ""}`
      ),
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApplicationInput) =>
      apiClient<CandidateApplication>("/api/applications", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
      qc.invalidateQueries({ queryKey: ["candidate-applications"] });
    },
  });
}

/**
 * Legacy stage-move mutation — kept for list-view callers. The pipeline
 * board uses the optimistic variant in `@/hooks/use-pipeline`.
 */
export function useMoveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      apiClient(`/api/applications/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
      qc.invalidateQueries({ queryKey: ["candidate-applications"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });
}

export function useAssignAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      agentUserId,
    }: {
      id: string;
      agentUserId: string;
    }) =>
      apiClient(`/api/applications/${id}/agent`, {
        method: "PATCH",
        body: JSON.stringify({ agentUserId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
    },
  });
}

export function useMarkSentToClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sent }: { id: string; sent: boolean }) =>
      apiClient(`/api/applications/${id}/sent-to-client`, {
        method: "PATCH",
        body: JSON.stringify({ sent }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
    },
  });
}

export function useUpdateQualification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      rejectReason,
    }: {
      id: string;
      status: string;
      rejectReason?: string;
    }) =>
      apiClient(`/api/applications/${id}/qualification`, {
        method: "PATCH",
        body: JSON.stringify({ status, rejectReason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
      qc.invalidateQueries({ queryKey: ["candidate-applications"] });
    },
  });
}

export function useStageHistory(applicationId: string) {
  return useQuery({
    queryKey: ["stage-history", applicationId],
    queryFn: () => apiClient(`/api/applications/${applicationId}/history`),
    enabled: !!applicationId,
  });
}
