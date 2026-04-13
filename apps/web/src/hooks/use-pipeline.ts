"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/**
 * Phase 2 pipeline board hook.
 *
 * Shape contract comes from apps/api/src/routes/pipeline.routes.ts
 * (GET /api/pipeline/:vacancyId). See packages/types for upstream
 * application types.
 */

export type PipelineCard = {
  id: string;
  candidateId: string;
  currentStageId: string | null;
  ownerId: string;
  qualificationStatus: "pending" | "yes" | "maybe" | "no";
  sentToClient: boolean;
  sentToHiringManager: boolean;
  sourceDetail: string | null;
  firstName: string | null;
  lastName: string | null;
  source: string | null;
  hasOverdueTask: boolean;
  aiVerdict?: "yes" | "maybe" | "no" | null;
  aiConfidence?: number | null;
};

export type PipelineStage = {
  id: string;
  name: string;
  sortOrder: number;
  applications: PipelineCard[];
};

export type PipelineBoard = { stages: PipelineStage[] };

export type PipelineFilters = {
  owner?: string | null;
  source?: string | null;
  stage?: string | null;
};

export function usePipeline(
  vacancyId: string,
  filters?: PipelineFilters
) {
  const qs = new URLSearchParams();
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v) qs.set(k, String(v));
    }
  }
  const qsString = qs.toString();
  return useQuery<PipelineBoard>({
    queryKey: ["pipeline", vacancyId, filters ?? null],
    queryFn: () =>
      apiClient<PipelineBoard>(
        `/api/pipeline/${vacancyId}${qsString ? `?${qsString}` : ""}`
      ),
    enabled: !!vacancyId,
  });
}

/**
 * Stage move mutation with optimistic update + rollback.
 * Drag-and-drop feels instant even over a slow network; on error
 * the board snaps back and TanStack Query refetches the truth.
 */
export function useMoveStage(vacancyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      toStageId,
    }: {
      applicationId: string;
      toStageId: string;
    }) =>
      apiClient(`/api/applications/${applicationId}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId: toStageId }),
      }),
    onMutate: async ({ applicationId, toStageId }) => {
      await qc.cancelQueries({ queryKey: ["pipeline", vacancyId] });
      const previous = qc.getQueriesData<PipelineBoard>({
        queryKey: ["pipeline", vacancyId],
      });
      qc.setQueriesData<PipelineBoard>(
        { queryKey: ["pipeline", vacancyId] },
        (old) => {
          if (!old) return old;
          let moved: PipelineCard | undefined;
          const stripped = old.stages.map((s) => ({
            ...s,
            applications: s.applications.filter((a) => {
              if (a.id === applicationId) {
                moved = { ...a, currentStageId: toStageId };
                return false;
              }
              return true;
            }),
          }));
          if (!moved) return old;
          return {
            stages: stripped.map((s) =>
              s.id === toStageId
                ? { ...s, applications: [...s.applications, moved!] }
                : s
            ),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        for (const [key, data] of ctx.previous) {
          qc.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", vacancyId] });
    },
  });
}
