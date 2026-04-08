"use client";

/**
 * URL-backed pipeline filters. Owner / source / stage live in the
 * query string via nuqs so recruiters can share filtered board URLs.
 */

import { useQueryState } from "nuqs";
import { useEffect } from "react";
import type { PipelineFilters as Filters } from "@/hooks/use-pipeline";

type Props = {
  onChange: (filters: Filters) => void;
};

export function PipelineFilters({ onChange }: Props) {
  const [owner, setOwner] = useQueryState("owner");
  const [source, setSource] = useQueryState("source");
  const [stage, setStage] = useQueryState("stage");

  // Re-emit whenever URL state changes so the board refetches.
  useEffect(() => {
    onChange({ owner, source, stage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, source, stage]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white text-sm">
      <div className="flex items-center gap-2">
        <label
          htmlFor="pipeline-filter-owner"
          className="text-xs text-slate-500"
        >
          Owner
        </label>
        <input
          id="pipeline-filter-owner"
          className="h-8 w-40 border border-slate-200 rounded px-2"
          value={owner ?? ""}
          onChange={(e) => setOwner(e.target.value || null)}
          placeholder="user id"
        />
      </div>
      <div className="flex items-center gap-2">
        <label
          htmlFor="pipeline-filter-source"
          className="text-xs text-slate-500"
        >
          Source
        </label>
        <input
          id="pipeline-filter-source"
          className="h-8 w-40 border border-slate-200 rounded px-2"
          value={source ?? ""}
          onChange={(e) => setSource(e.target.value || null)}
          placeholder="indeed, marktplaats…"
        />
      </div>
      <div className="flex items-center gap-2">
        <label
          htmlFor="pipeline-filter-stage"
          className="text-xs text-slate-500"
        >
          Stage
        </label>
        <input
          id="pipeline-filter-stage"
          className="h-8 w-40 border border-slate-200 rounded px-2"
          value={stage ?? ""}
          onChange={(e) => setStage(e.target.value || null)}
          placeholder="stage id"
        />
      </div>
      {(owner || source || stage) && (
        <button
          type="button"
          onClick={() => {
            setOwner(null);
            setSource(null);
            setStage(null);
          }}
          className="ml-auto text-xs text-slate-500 hover:text-slate-800 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
