/**
 * Bulk action types for POST /api/applications/bulk and
 * POST /api/applications/bulk-by-filter.
 *
 * These mirror Plan 02-02's `z.discriminatedUnion("action", ...)` EXACTLY.
 * Every variant has a nested `payload` object (NOT flat fields like
 * `targetStageId` / `reason` / `tagLabel`). Do not diverge — the frontend
 * (Plan 02-04) imports these types directly and sends them on the wire.
 */

/**
 * Bulk action variants for the by-IDs path.
 * Each variant carries `applicationIds` plus an action-specific `payload`.
 */
export type BulkAction =
  | {
      action: "move";
      applicationIds: string[];
      payload: { stageId: string };
    }
  | {
      action: "reject";
      applicationIds: string[];
      payload: { rejectReason: string; rejectStageId?: string };
    }
  | {
      action: "assign";
      applicationIds: string[];
      payload: { ownerId?: string; agentUserId?: string };
    }
  | {
      action: "tag";
      applicationIds: string[];
      payload: { tag: string };
    };

/**
 * Body shape for POST /api/applications/bulk (the by-IDs path).
 * Alias of BulkAction so call sites can use either name.
 */
export type BulkByIdsPayload = BulkAction;

/**
 * Filter shape used by the by-filter bulk path.
 * Mirrors the filter params accepted by GET /api/applications.
 */
export type BulkFilter = {
  stageId?: string;
  source?: string;
  vacancyId?: string;
  ownerId?: string;
  qualificationStatus?: "pending" | "yes" | "maybe" | "no";
};

/**
 * Body shape for POST /api/applications/bulk-by-filter.
 * Same discriminated union as BulkAction but with a `filter` object
 * instead of an `applicationIds` array.
 */
export type BulkByFilterPayload =
  | {
      action: "move";
      filter: BulkFilter;
      payload: { stageId: string };
    }
  | {
      action: "reject";
      filter: BulkFilter;
      payload: { rejectReason: string; rejectStageId?: string };
    }
  | {
      action: "assign";
      filter: BulkFilter;
      payload: { ownerId?: string; agentUserId?: string };
    }
  | {
      action: "tag";
      filter: BulkFilter;
      payload: { tag: string };
    };

/**
 * Response from POST /api/applications/bulk (by-IDs).
 * `updated` = number of rows affected. `ids` = the IDs that were touched.
 * Do NOT rename to `affected` / `activityLogIds` — the frontend reads these names.
 */
export interface BulkByIdsResult {
  updated: number;
  ids: string[];
}

/**
 * Response from POST /api/applications/bulk-by-filter.
 * `updated` = total rows affected across all batches.
 * `batches` = number of batches the backend split the filter into.
 */
export interface BulkByFilterResult {
  updated: number;
  batches: number;
}
