"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CandidateDocument } from "@recruitment-os/types";

interface UploadDocumentInput {
  candidateId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
  documentType: string;
  expiresAt?: string | null;
  contentHash?: string | null;
}

export function useDocuments(candidateId: string) {
  return useQuery<CandidateDocument[]>({
    queryKey: ["documents", candidateId],
    queryFn: () =>
      apiClient(`/api/documents/candidate/${candidateId}`),
    enabled: !!candidateId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UploadDocumentInput) =>
      apiClient<CandidateDocument>("/api/documents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["documents", variables.candidateId],
      });
    },
  });
}

export function useExpiringDocuments(days: number = 30) {
  return useQuery<CandidateDocument[]>({
    queryKey: ["expiring-documents", days],
    queryFn: () => apiClient(`/api/documents/expiring?days=${days}`),
  });
}

export function useDuplicateCheck(contentHash: string | null | undefined) {
  return useQuery<{ exists: boolean; document: CandidateDocument | null }>({
    queryKey: ["document-duplicate", contentHash],
    queryFn: () =>
      apiClient(`/api/documents/duplicate/${contentHash}`),
    enabled: !!contentHash,
  });
}
