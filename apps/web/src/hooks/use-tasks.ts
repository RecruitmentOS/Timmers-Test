"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Task,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
} from "@recruitment-os/types";

/**
 * Tasks query + mutation hooks.
 *
 * All calls go through the callable `apiClient<T>(path, init?)` function —
 * never `apiClient.get/.post/.patch/.delete`.
 */

export function useTasks(filters: TaskFilters = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") {
      qs.set(k, String(v));
    }
  }
  const qsString = qs.toString();
  return useQuery<Task[]>({
    queryKey: ["tasks", filters],
    queryFn: () =>
      apiClient<Task[]>(`/api/tasks${qsString ? `?${qsString}` : ""}`),
    staleTime: 10_000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: (input: CreateTaskInput) =>
      apiClient<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "open-tasks"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation<
    Task,
    Error,
    { id: string; patch: UpdateTaskInput }
  >({
    mutationFn: ({ id, patch }) =>
      apiClient<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/**
 * Complete a task with optimistic update: the row flips to completed
 * immediately; on server error the cache is rolled back.
 */
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation<
    Task,
    Error,
    { id: string },
    { previous: Array<[readonly unknown[], Task[] | undefined]> }
  >({
    mutationFn: ({ id }) =>
      apiClient<Task>(`/api/tasks/${id}/complete`, {
        method: "POST",
      }),
    onMutate: async ({ id }) => {
      // Snapshot and optimistically patch all cached ["tasks", ...] entries.
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previous = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      const nowIso = new Date().toISOString();
      for (const [key, data] of previous) {
        if (!data) continue;
        qc.setQueryData<Task[]>(
          key,
          data.map((t) =>
            t.id === id ? { ...t, status: "completed", completedAt: nowIso } : t
          )
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      for (const [key, data] of ctx.previous) {
        qc.setQueryData(key, data);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "open-tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "overdue-follow-ups"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { id: string }>({
    mutationFn: ({ id }) =>
      apiClient<{ ok: true }>(`/api/tasks/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "open-tasks"] });
    },
  });
}
