"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  OrgSettings,
  TeamMember,
  PipelineStageConfig,
  QualificationPreset,
} from "@recruitment-os/types";

// ==========================================
// Organization settings
// ==========================================

export function useOrgSettings() {
  return useQuery<OrgSettings>({
    queryKey: ["admin", "settings"],
    queryFn: () => apiClient("/api/admin/settings"),
  });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; logo?: string | null; metadata?: string | null }) =>
      apiClient<OrgSettings>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });
}

// ==========================================
// Team members
// ==========================================

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ["admin", "team"],
    queryFn: () => apiClient("/api/admin/team"),
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiClient("/api/admin/team/invite", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      apiClient(`/api/admin/team/${memberId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiClient(`/api/admin/team/${memberId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "team"] }),
  });
}

// ==========================================
// Pipeline stages
// ==========================================

export function usePipelineStages() {
  return useQuery<PipelineStageConfig[]>({
    queryKey: ["admin", "pipeline-stages"],
    queryFn: () => apiClient("/api/admin/pipeline-stages"),
  });
}

export function useCreatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient("/api/admin/pipeline-stages", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "pipeline-stages"] }),
  });
}

export function useReorderPipelineStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageIds: string[]) =>
      apiClient("/api/admin/pipeline-stages/reorder", {
        method: "POST",
        body: JSON.stringify({ stageIds }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "pipeline-stages"] }),
  });
}

export function useUpdatePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, name }: { stageId: string; name: string }) =>
      apiClient(`/api/admin/pipeline-stages/${stageId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "pipeline-stages"] }),
  });
}

export function useDeletePipelineStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) =>
      apiClient(`/api/admin/pipeline-stages/${stageId}`, { method: "DELETE" }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "pipeline-stages"] }),
  });
}

// ==========================================
// Qualification presets
// ==========================================

export function useQualificationPresets() {
  return useQuery<QualificationPreset[]>({
    queryKey: ["admin", "qualification-presets"],
    queryFn: () => apiClient("/api/admin/qualification-presets"),
  });
}

export function useCreateQualificationPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; criteria: string; isDefault?: boolean }) =>
      apiClient("/api/admin/qualification-presets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "qualification-presets"] }),
  });
}

export function useUpdateQualificationPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      presetId,
      ...data
    }: {
      presetId: string;
      name?: string;
      criteria?: string;
      isDefault?: boolean;
    }) =>
      apiClient(`/api/admin/qualification-presets/${presetId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "qualification-presets"] }),
  });
}

export function useDeleteQualificationPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (presetId: string) =>
      apiClient(`/api/admin/qualification-presets/${presetId}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "qualification-presets"] }),
  });
}
