"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  BulkAction,
  BulkByIdsPayload,
  BulkByFilterPayload,
  BulkByIdsResult,
  BulkByFilterResult,
  BulkFilter,
} from "@recruitment-os/types";

/**
 * Bulk action hooks for /api/applications/bulk and /api/applications/bulk-by-filter.
 *
 * The CRITICAL invariant: the `applicationIds` vs `filter` discrimination
 * lives EXCLUSIVELY in `useBulkActionsHandler` below — the toolbar and
 * confirmation modal NEVER see or mention either key.
 *
 * Payload shape is nested (mirrors 02-02's z.discriminatedUnion):
 *   { action: "move", applicationIds: [...], payload: { stageId } }
 * NOT flat (NO `targetStageId`, NO `rejectReasonText`).
 */

/**
 * Mutation: POST /api/applications/bulk (by-IDs path).
 * Caller provides a full BulkByIdsPayload (including applicationIds).
 */
export function useBulkActionsByIds() {
  const qc = useQueryClient();
  return useMutation<BulkByIdsResult, Error, BulkByIdsPayload>({
    mutationFn: (payload: BulkByIdsPayload) =>
      apiClient<BulkByIdsResult>("/api/applications/bulk", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Invalidate everything a bulk mutation can affect.
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
      qc.invalidateQueries({ queryKey: ["candidate-applications"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/**
 * Mutation: POST /api/applications/bulk-by-filter (by-filter path).
 * Caller provides a full BulkByFilterPayload (including filter).
 */
export function useBulkActionsByFilter() {
  const qc = useQueryClient();
  return useMutation<BulkByFilterResult, Error, BulkByFilterPayload>({
    mutationFn: (payload: BulkByFilterPayload) =>
      apiClient<BulkByFilterResult>("/api/applications/bulk-by-filter", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["vacancy-applications"] });
      qc.invalidateQueries({ queryKey: ["candidate-applications"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/**
 * Slim BulkAction shape WITHOUT applicationIds — this is what the
 * confirmation modal hands back to the page. The handler below injects
 * either `applicationIds` or `filter` based on `isAllMatchingSelected`.
 */
export type BulkActionInput =
  | { action: "move"; payload: { stageId: string } }
  | {
      action: "reject";
      payload: { rejectReason: string; rejectStageId?: string };
    }
  | {
      action: "assign";
      payload: { ownerId?: string; agentUserId?: string };
    }
  | { action: "tag"; payload: { tag: string } };

export type BulkActionOutcome =
  | { kind: "ids"; result: BulkByIdsResult }
  | { kind: "filter"; result: BulkByFilterResult };

type UseBulkActionsHandlerArgs = {
  selectedIds: string[];
  filter: BulkFilter;
  isAllMatchingSelected: boolean;
};

/**
 * SINGLE branching point for the by-IDs vs by-filter decision.
 * The toolbar and modal never know which code path is active — they only
 * build a `BulkActionInput` and call `handler(input)`.
 *
 * Returns `{ execute, isPending, error }` where `execute` always returns
 * a promise resolving to the result shape.
 */
export function useBulkActionsHandler({
  selectedIds,
  filter,
  isAllMatchingSelected,
}: UseBulkActionsHandlerArgs) {
  const byIds = useBulkActionsByIds();
  const byFilter = useBulkActionsByFilter();

  const execute = useCallback(
    async (input: BulkActionInput): Promise<BulkActionOutcome> => {
      // isAllMatchingSelected drives the branch — callers are oblivious.
      if (isAllMatchingSelected) {
        // Build the by-filter payload. TypeScript needs a narrow per action
        // because discriminated-union narrowing does not survive `...input`.
        let payload: BulkByFilterPayload;
        switch (input.action) {
          case "move":
            payload = {
              action: "move",
              filter,
              payload: input.payload,
            };
            break;
          case "reject":
            payload = {
              action: "reject",
              filter,
              payload: input.payload,
            };
            break;
          case "assign":
            payload = {
              action: "assign",
              filter,
              payload: input.payload,
            };
            break;
          case "tag":
            payload = {
              action: "tag",
              filter,
              payload: input.payload,
            };
            break;
        }
        const result = await byFilter.mutateAsync(payload);
        return { kind: "filter", result };
      }

      // By-IDs path.
      let payload: BulkByIdsPayload;
      switch (input.action) {
        case "move":
          payload = {
            action: "move",
            applicationIds: selectedIds,
            payload: input.payload,
          };
          break;
        case "reject":
          payload = {
            action: "reject",
            applicationIds: selectedIds,
            payload: input.payload,
          };
          break;
        case "assign":
          payload = {
            action: "assign",
            applicationIds: selectedIds,
            payload: input.payload,
          };
          break;
        case "tag":
          payload = {
            action: "tag",
            applicationIds: selectedIds,
            payload: input.payload,
          };
          break;
      }
      const result = await byIds.mutateAsync(payload);
      return { kind: "ids", result };
    },
    [byIds, byFilter, filter, isAllMatchingSelected, selectedIds]
  );

  return {
    execute,
    isPending: byIds.isPending || byFilter.isPending,
    error: byIds.error ?? byFilter.error,
  };
}

// Re-export the full BulkAction type for convenience so components that
// need the narrow type (without the ids-vs-filter discrimination) can
// import it from this module.
export type { BulkAction };
