"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Interview, InterviewScorecard, CreateScorecardInput } from "@recruitment-os/types";

/**
 * List interviews with optional filters.
 */
export function useInterviews(filters?: {
  vacancyId?: string;
  candidateId?: string;
  applicationId?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.vacancyId) params.set("vacancyId", filters.vacancyId);
  if (filters?.candidateId) params.set("candidateId", filters.candidateId);
  if (filters?.applicationId)
    params.set("applicationId", filters.applicationId);
  const qs = params.toString();

  return useQuery<Interview[]>({
    queryKey: ["interviews", filters],
    queryFn: () => apiClient(`/api/interviews${qs ? `?${qs}` : ""}`),
  });
}

/**
 * Schedule a new interview.
 */
export function useScheduleInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      applicationId: string;
      vacancyId: string;
      candidateId: string;
      calendarConnectionId?: string;
      scheduledAt: string;
      durationMinutes?: number;
      location?: string;
      notes?: string;
      candidateName: string;
      candidateEmail?: string;
      vacancyTitle: string;
    }) =>
      apiClient<Interview>("/api/interviews", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/**
 * Cancel an interview.
 */
export function useCancelInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (interviewId: string) =>
      apiClient(`/api/interviews/${interviewId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
    },
  });
}

/**
 * Fetch scorecard for a specific interview.
 */
export function useInterviewScorecard(interviewId: string) {
  return useQuery<{ scorecard: InterviewScorecard | null }>({
    queryKey: ["interview-scorecard", interviewId],
    queryFn: () =>
      apiClient<{ scorecard: InterviewScorecard | null }>(
        `/api/interviews/${interviewId}/scorecard`
      ),
    enabled: !!interviewId,
    staleTime: 30_000,
  });
}

/**
 * Submit (create or update) a scorecard for an interview.
 */
export function useSubmitScorecard(interviewId: string) {
  const queryClient = useQueryClient();
  return useMutation<InterviewScorecard, Error, CreateScorecardInput>({
    mutationFn: (input) =>
      apiClient<InterviewScorecard>(`/api/interviews/${interviewId}/scorecard`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interview-scorecard", interviewId] });
    },
  });
}
