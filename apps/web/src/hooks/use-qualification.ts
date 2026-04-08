"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/**
 * Qualification verdict mutation.
 * Backend: PATCH /api/applications/:id/qualification
 * Accepts status/rejectReason/qualificationNotes/advanceStage.
 */
export type QualifyInput = {
  applicationId: string;
  status: "yes" | "maybe" | "no";
  rejectReason?: string;
  qualificationNotes?: string;
  advanceStage?: boolean;
};

export function useQualify(vacancyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, ...rest }: QualifyInput) =>
      apiClient(`/api/applications/${applicationId}/qualification`, {
        method: "PATCH",
        body: JSON.stringify(rest),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", vacancyId] });
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
      qc.invalidateQueries({ queryKey: ["candidate-applications"] });
    },
  });
}
