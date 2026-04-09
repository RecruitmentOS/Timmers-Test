"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────

export type PortalVacancy = {
  id: string;
  title: string;
  location: string | null;
  status: string;
  createdAt: string;
  candidateCount: number;
  stageCounts: { name: string; count: number }[];
};

export type PortalCandidate = {
  id: string;
  candidateId: string;
  name: string;
  stage: string;
  qualificationStatus: string;
  appliedDate: string;
};

// ─── Client Portal Hooks ───────────────────────────────────────

export function useClientVacancies() {
  return useQuery<PortalVacancy[]>({
    queryKey: ["portal", "client", "vacancies"],
    queryFn: () => apiClient("/api/portal/client/vacancies"),
  });
}

export function useClientCandidates(vacancyId: string) {
  return useQuery<PortalCandidate[]>({
    queryKey: ["portal", "client", "candidates", vacancyId],
    queryFn: () =>
      apiClient(`/api/portal/client/vacancies/${vacancyId}/candidates`),
    enabled: !!vacancyId,
  });
}

// ─── HM Portal Hooks ──────────────────────────────────────────

export function useHMVacancies() {
  return useQuery<PortalVacancy[]>({
    queryKey: ["portal", "hm", "vacancies"],
    queryFn: () => apiClient("/api/portal/hm/vacancies"),
  });
}

export function useHMCandidates(vacancyId: string) {
  return useQuery<PortalCandidate[]>({
    queryKey: ["portal", "hm", "candidates", vacancyId],
    queryFn: () =>
      apiClient(`/api/portal/hm/vacancies/${vacancyId}/candidates`),
    enabled: !!vacancyId,
  });
}

// ─── Shared Mutations ──────────────────────────────────────────

export function useSubmitFeedback(portalType: "client" | "hm") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      applicationId: string;
      body: string;
      feedbackThumb: "up" | "down";
    }) =>
      apiClient(`/api/portal/${portalType}/feedback`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal", portalType, "candidates"] });
    },
  });
}

export function useRequestMoreCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vacancyId: string) =>
      apiClient(`/api/portal/hm/vacancies/${vacancyId}/request-candidates`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal", "hm"] });
    },
  });
}
