"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  AIScreeningResponse,
  AIScreeningLog,
  AIUsage,
} from "@recruitment-os/types";

/**
 * Trigger AI screening for a candidate application.
 * Invalidates screening history on success.
 */
export function useTriggerScreening() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { applicationId: string; force?: boolean }) =>
      apiClient<AIScreeningResponse>("/api/ai-screening/trigger", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["ai-screening-history", variables.applicationId],
      });
      qc.invalidateQueries({ queryKey: ["ai-usage"] });
    },
  });
}

/**
 * Get a single screening result by log ID.
 */
export function useScreeningResult(logId: string | null) {
  return useQuery<AIScreeningLog>({
    queryKey: ["ai-screening", logId],
    queryFn: () => apiClient<AIScreeningLog>(`/api/ai-screening/${logId}`),
    enabled: !!logId,
  });
}

/**
 * Get screening history for an application.
 */
export function useScreeningHistory(applicationId: string | null) {
  return useQuery<AIScreeningLog[]>({
    queryKey: ["ai-screening-history", applicationId],
    queryFn: () =>
      apiClient<AIScreeningLog[]>(
        `/api/ai-screening/history/${applicationId}`
      ),
    enabled: !!applicationId,
  });
}

/**
 * Get current month AI usage stats.
 */
export function useAIUsage() {
  return useQuery<AIUsage>({
    queryKey: ["ai-usage"],
    queryFn: () => apiClient<AIUsage>("/api/ai-screening/usage"),
  });
}
