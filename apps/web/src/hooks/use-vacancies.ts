"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Vacancy, CreateVacancyInput, UpdateVacancyInput } from "@recruitment-os/types";

export function useVacancies(filters?: Record<string, string>) {
  const params = filters
    ? new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      ).toString()
    : "";
  return useQuery<Vacancy[]>({
    queryKey: ["vacancies", filters],
    queryFn: () => apiClient(`/api/vacancies${params ? `?${params}` : ""}`),
  });
}

export function useVacancy(id: string) {
  return useQuery<Vacancy>({
    queryKey: ["vacancy", id],
    queryFn: () => apiClient(`/api/vacancies/${id}`),
    enabled: !!id,
  });
}

export function useCreateVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVacancyInput) =>
      apiClient<Vacancy>("/api/vacancies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacancies"] }),
  });
}

export function useUpdateVacancy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateVacancyInput) =>
      apiClient<Vacancy>(`/api/vacancies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vacancies"] });
      qc.invalidateQueries({ queryKey: ["vacancy", id] });
    },
  });
}

export function useDeleteVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/vacancies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vacancies"] }),
  });
}

export function useVacancyApplications(vacancyId: string) {
  return useQuery({
    queryKey: ["vacancy-applications", vacancyId],
    queryFn: () => apiClient(`/api/vacancies/${vacancyId}/applications`),
    enabled: !!vacancyId,
  });
}

export function useVacancyNotes(vacancyId: string) {
  return useQuery({
    queryKey: ["vacancy-notes", vacancyId],
    queryFn: () => apiClient(`/api/vacancies/${vacancyId}/notes`),
    enabled: !!vacancyId,
  });
}

export function useAddVacancyNote(vacancyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiClient(`/api/vacancies/${vacancyId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["vacancy-notes", vacancyId] }),
  });
}

export function useVacancyAssignments(vacancyId: string) {
  return useQuery({
    queryKey: ["vacancy-assignments", vacancyId],
    queryFn: () => apiClient(`/api/vacancies/${vacancyId}/assignments`),
    enabled: !!vacancyId,
  });
}
