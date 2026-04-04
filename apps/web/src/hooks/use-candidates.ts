"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Candidate, CreateCandidateInput, UpdateCandidateInput } from "@recruitment-os/types";

export function useCandidates(filters?: Record<string, string>) {
  const params = filters
    ? new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      ).toString()
    : "";
  return useQuery<Candidate[]>({
    queryKey: ["candidates", filters],
    queryFn: () => apiClient(`/api/candidates${params ? `?${params}` : ""}`),
  });
}

export function useCandidate(id: string) {
  return useQuery<Candidate>({
    queryKey: ["candidate", id],
    queryFn: () => apiClient(`/api/candidates/${id}`),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCandidateInput) =>
      apiClient<Candidate>("/api/candidates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });
}

export function useUpdateCandidate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCandidateInput) =>
      apiClient<Candidate>(`/api/candidates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["candidate", id] });
    },
  });
}

export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/candidates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
  });
}

export function useCandidateApplications(candidateId: string) {
  return useQuery({
    queryKey: ["candidate-applications", candidateId],
    queryFn: () => apiClient(`/api/candidates/${candidateId}/applications`),
    enabled: !!candidateId,
  });
}

export function useCandidateTimeline(candidateId: string) {
  return useQuery({
    queryKey: ["candidate-timeline", candidateId],
    queryFn: () => apiClient(`/api/candidates/${candidateId}/timeline`),
    enabled: !!candidateId,
  });
}

export function useCandidateFiles(candidateId: string) {
  return useQuery({
    queryKey: ["candidate-files", candidateId],
    queryFn: () => apiClient(`/api/candidates/${candidateId}/files`),
    enabled: !!candidateId,
  });
}
