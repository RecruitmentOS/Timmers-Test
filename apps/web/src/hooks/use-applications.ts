"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CandidateApplication, CreateApplicationInput } from "@recruitment-os/types";

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
