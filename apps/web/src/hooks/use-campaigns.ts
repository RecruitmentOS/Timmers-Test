"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Campaign,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignDashboardMetrics,
  TargetingTemplate,
  CreateTargetingTemplateInput,
  PersonaTemplate,
  CreatePersonaTemplateInput,
  MetaConnection,
} from "@recruitment-os/types";

// --- Campaign hooks ---

export function useCampaigns(vacancyId?: string) {
  const params = vacancyId ? `?vacancyId=${vacancyId}` : "";
  return useQuery<Campaign[]>({
    queryKey: ["campaigns", vacancyId],
    queryFn: () => apiClient(`/api/campaigns${params}`),
  });
}

export function useCampaign(id: string) {
  return useQuery<Campaign>({
    queryKey: ["campaign", id],
    queryFn: () => apiClient(`/api/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCampaignMetrics(id: string) {
  return useQuery<CampaignDashboardMetrics>({
    queryKey: ["campaign-metrics", id],
    queryFn: () => apiClient(`/api/campaigns/${id}/metrics`),
    enabled: !!id,
  });
}

export function useCampaignApplications(id: string) {
  return useQuery({
    queryKey: ["campaign-applications", id],
    queryFn: () => apiClient<Array<Record<string, unknown>>>(`/api/campaigns/${id}/applications`),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCampaignInput) =>
      apiClient<Campaign>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignInput }) =>
      apiClient<Campaign>(`/api/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign", vars.id] });
      qc.invalidateQueries({ queryKey: ["campaign-metrics", vars.id] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

// --- Targeting template hooks ---

export function useTargetingTemplates() {
  return useQuery<TargetingTemplate[]>({
    queryKey: ["targeting-templates"],
    queryFn: () => apiClient("/api/targeting-templates"),
  });
}

export function useCreateTargetingTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTargetingTemplateInput) =>
      apiClient<TargetingTemplate>("/api/targeting-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["targeting-templates"] }),
  });
}

// --- Persona template hooks ---

export function usePersonaTemplates(vacancyId?: string) {
  const params = vacancyId ? `?vacancyId=${vacancyId}` : "";
  return useQuery<PersonaTemplate[]>({
    queryKey: ["persona-templates", vacancyId],
    queryFn: () => apiClient(`/api/persona-templates${params}`),
  });
}

export function useCreatePersonaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonaTemplateInput) =>
      apiClient<PersonaTemplate>("/api/persona-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["persona-templates"] }),
  });
}

// --- Meta integration hooks ---

export function useMetaStatus() {
  return useQuery<MetaConnection | null>({
    queryKey: ["meta-status"],
    queryFn: () => apiClient("/api/meta/status"),
  });
}

export function useConnectMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { adAccountId: string; accessToken: string }) =>
      apiClient<MetaConnection>("/api/meta/connect", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-status"] }),
  });
}

export function useDisconnectMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient("/api/meta/disconnect", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meta-status"] }),
  });
}

export function useLaunchMetaAd(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient(`/api/meta/campaigns/${campaignId}/launch`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
