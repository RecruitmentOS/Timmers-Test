"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CVParseResult, CVParseStatus } from "@recruitment-os/types";

interface TriggerParseResponse {
  parseLogId: string;
  status: CVParseStatus;
  parsedData: CVParseResult | null;
  duplicate: boolean;
}

interface ParseStatusResponse {
  status: CVParseStatus | null;
  parsedData: CVParseResult | null;
  errorMessage: string | null;
}

interface DuplicateCheckResponse {
  duplicate: boolean;
  parsedData: CVParseResult | null;
}

/**
 * Mutation to trigger CV parsing for an uploaded file.
 */
export function useTriggerCvParse() {
  return useMutation({
    mutationFn: (data: { fileId: string; candidateId?: string }) =>
      apiClient<TriggerParseResponse>("/api/cv-parse/trigger", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

/**
 * Poll for CV parse status. Refetches every 2s while status is pending/processing.
 * Stops polling when status is success or error.
 */
export function useCvParseStatus(fileId: string | null) {
  return useQuery<ParseStatusResponse>({
    queryKey: ["cv-parse-status", fileId],
    queryFn: () => apiClient<ParseStatusResponse>(`/api/cv-parse/${fileId}/status`),
    enabled: !!fileId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "pending" || status === "processing") {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * Mutation to check if a content hash already has a cached parse result.
 */
export function useDuplicateCheck() {
  return useMutation({
    mutationFn: (data: { contentHash: string }) =>
      apiClient<DuplicateCheckResponse>("/api/cv-parse/hash", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
