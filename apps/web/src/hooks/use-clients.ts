"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Client, CreateClientInput, UpdateClientInput } from "@recruitment-os/types";

export function useClients() {
  return useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: () => apiClient("/api/clients"),
  });
}

export function useClient(id: string) {
  return useQuery<Client>({
    queryKey: ["client", id],
    queryFn: () => apiClient(`/api/clients/${id}`),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientInput) =>
      apiClient<Client>("/api/clients", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateClientInput) =>
      apiClient<Client>(`/api/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", id] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useClientVacancyAccess(clientId: string) {
  return useQuery({
    queryKey: ["client-vacancy-access", clientId],
    queryFn: () => apiClient(`/api/clients/${clientId}/vacancy-access`),
    enabled: !!clientId,
  });
}

export function useAddClientVacancyAccess(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vacancyId: string) =>
      apiClient(`/api/clients/${clientId}/vacancy-access`, {
        method: "POST",
        body: JSON.stringify({ vacancyId }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["client-vacancy-access", clientId],
      }),
  });
}

export function useClientUsers(clientId: string) {
  return useQuery({
    queryKey: ["client-users", clientId],
    queryFn: () => apiClient(`/api/clients/${clientId}/users`),
    enabled: !!clientId,
  });
}

export function useInviteClientUser(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiClient(`/api/clients/${clientId}/invite-client-user`, {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["client-users", clientId] }),
  });
}
