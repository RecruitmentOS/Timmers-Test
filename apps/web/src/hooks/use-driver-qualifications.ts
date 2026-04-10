"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  DriverQualification,
  CreateDriverQualificationInput,
  LicenseBadge,
} from "@recruitment-os/types";

export function useDriverQualifications(candidateId: string) {
  return useQuery<DriverQualification[]>({
    queryKey: ["driver-qualifications", candidateId],
    queryFn: () =>
      apiClient(`/api/driver-qualifications/${candidateId}`),
    enabled: !!candidateId,
  });
}

export function useLicenseBadges(candidateId: string) {
  return useQuery<LicenseBadge[]>({
    queryKey: ["license-badges", candidateId],
    queryFn: () =>
      apiClient(`/api/driver-qualifications/${candidateId}/badges`),
    enabled: !!candidateId,
  });
}

export function useCreateQualification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDriverQualificationInput) =>
      apiClient<DriverQualification>("/api/driver-qualifications", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["driver-qualifications", variables.candidateId],
      });
      qc.invalidateQueries({
        queryKey: ["license-badges", variables.candidateId],
      });
    },
  });
}

export function useDeleteQualification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient(`/api/driver-qualifications/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-qualifications"] });
      qc.invalidateQueries({ queryKey: ["license-badges"] });
    },
  });
}

export function useLicenseMismatch(
  candidateId: string,
  vacancyId: string
) {
  return useQuery<{ missing: string[]; hasAll: boolean }>({
    queryKey: ["license-mismatch", candidateId, vacancyId],
    queryFn: () =>
      apiClient(
        `/api/driver-qualifications/${candidateId}/mismatch/${vacancyId}`
      ),
    enabled: !!candidateId && !!vacancyId,
  });
}
