// apps/web/src/hooks/use-intake.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { IntakeSession, IntakeMessage, IntakeTemplate } from "@recruitment-os/types";

type SessionRow = Pick<IntakeSession, "id" | "state" | "verdict" | "createdAt" | "lastInboundAt" | "lastOutboundAt"> & {
  candidateName: string;
  vacancyTitle: string;
};

export function useIntakeSessions(state?: IntakeSession["state"]) {
  const qs = state ? `?state=${state}` : "";
  return useQuery<{ sessions: SessionRow[] }>({
    queryKey: ["intake-sessions", state],
    queryFn: () => apiClient(`/api/intake/sessions${qs}`),
  });
}

export function useIntakeSession(id: string) {
  return useQuery<{ session: IntakeSession; messages: IntakeMessage[] }>({
    queryKey: ["intake-session", id],
    queryFn: () => apiClient(`/api/intake/sessions/${id}`),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useIntakeTakeover(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient(`/api/intake/sessions/${id}/takeover`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-session", id] }),
  });
}

export function useIntakeManualReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiClient(`/api/intake/sessions/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
        headers: { "content-type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-session", id] }),
  });
}

export function useIntakeManualVerdict(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { verdict: "qualified" | "rejected" | "unsure"; reason: string }) =>
      apiClient(`/api/intake/sessions/${id}/manual-verdict`, {
        method: "POST",
        body: JSON.stringify(args),
        headers: { "content-type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-session", id] }),
  });
}

export function useIntakeTemplates() {
  return useQuery<{ templates: IntakeTemplate[] }>({
    queryKey: ["intake-templates"],
    queryFn: () => apiClient("/api/intake-templates/"),
  });
}

export function useUpdateIntakeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<IntakeTemplate> & { id: string }) =>
      apiClient(`/api/intake-templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
        headers: { "content-type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-templates"] }),
  });
}

export function useCriteriaSuggest() {
  return useMutation({
    mutationFn: (vacancyId: string) =>
      apiClient("/api/intake/criteria/suggest", {
        method: "POST",
        body: JSON.stringify({ vacancyId }),
        headers: { "content-type": "application/json" },
      }),
  });
}
