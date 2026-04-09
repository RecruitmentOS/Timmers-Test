"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// --- Types for agent portal data ---

export type AgentCandidate = {
  applicationId: string;
  candidateId: string;
  vacancyId: string;
  currentStageId: string | null;
  qualificationStatus: "pending" | "yes" | "maybe" | "no";
  candidateFirstName: string;
  candidateLastName: string;
  candidatePhone: string | null;
  candidateEmail: string | null;
  candidateCity: string | null;
  stageName: string | null;
  vacancyTitle: string | null;
  updatedAt: string;
};

export type AgentVacancy = {
  id: string;
  title: string;
  location: string | null;
  status: string;
  candidateCount: number;
};

export type AgentTask = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "completed";
  dueDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  completedAt: string | null;
};

export type AgentStats = {
  candidatesAdded: number;
  qualified: number;
  tasksCompleted: number;
};

// --- Query hooks ---

export function useAgentCandidates() {
  return useQuery<AgentCandidate[]>({
    queryKey: ["agent", "candidates"],
    queryFn: () => apiClient("/api/agent/candidates"),
  });
}

export function useAgentTasks() {
  return useQuery<AgentTask[]>({
    queryKey: ["agent", "tasks"],
    queryFn: () => apiClient("/api/agent/tasks"),
  });
}

export function useAgentStats(startDate?: string, endDate?: string) {
  const qs = new URLSearchParams();
  if (startDate) qs.set("startDate", startDate);
  if (endDate) qs.set("endDate", endDate);
  const qsString = qs.toString();

  return useQuery<AgentStats>({
    queryKey: ["agent", "stats", startDate, endDate],
    queryFn: () =>
      apiClient(`/api/agent/stats${qsString ? `?${qsString}` : ""}`),
  });
}

// --- Mutation hooks ---

export function useAgentMoveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      stageId,
    }: {
      applicationId: string;
      stageId: string;
    }) =>
      apiClient(`/api/agent/candidates/${applicationId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", "candidates"] });
    },
  });
}

export function useAgentAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      body,
    }: {
      applicationId: string;
      body: string;
    }) =>
      apiClient(`/api/agent/candidates/${applicationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", "candidates"] });
    },
  });
}

export function useAgentCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiClient(`/api/agent/tasks/${taskId}/complete`, {
        method: "POST",
      }),
    onMutate: async (taskId) => {
      // Optimistic update: mark task as completed
      await qc.cancelQueries({ queryKey: ["agent", "tasks"] });
      const previous = qc.getQueryData<AgentTask[]>(["agent", "tasks"]);
      qc.setQueryData<AgentTask[]>(["agent", "tasks"], (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, status: "completed" as const, completedAt: new Date().toISOString() }
            : t
        )
      );
      return { previous };
    },
    onError: (_err, _taskId, context) => {
      if (context?.previous) {
        qc.setQueryData(["agent", "tasks"], context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["agent", "tasks"] });
      qc.invalidateQueries({ queryKey: ["agent", "stats"] });
    },
  });
}
