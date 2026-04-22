"use client";

/**
 * Pipeline board — the Phase 2 recruiter hub.
 *
 * ISOLATION CONTRACT (02-CONTEXT.md + 02-03 critical rule 3):
 * All `@dnd-kit/react` imports live inside this folder. A future
 * fallback to `@dnd-kit/core@6.3` must be a one-file swap here plus
 * the column/card siblings. DO NOT import `@dnd-kit/*` from any file
 * outside `components/pipeline/`.
 */

import { DragDropProvider } from "@dnd-kit/react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  usePipeline,
  useMoveStage,
  type PipelineCard as CardType,
  type PipelineFilters,
} from "@/hooks/use-pipeline";
import { useIsEmployer } from "@/lib/use-mode";
import { PipelineColumn } from "./pipeline-column";
import { QualificationDrawer } from "@/components/qualification/qualification-drawer";
import { PlacementDrawer } from "@/components/placement-drawer";
import { usePipelineSync } from "@/hooks/use-socket";
import { useLiveCursors } from "@/hooks/use-live-cursors";
import { LiveCursorsLayer } from "./live-cursors-layer";
import { EmptyState } from "@/components/empty-state";
import { Columns3 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type Props = {
  vacancyId: string;
  filters?: PipelineFilters;
  /**
   * Compact mode — used inside the vacancy detail tab.
   * Limits height and hides the full-screen chrome.
   */
  compact?: boolean;
};

export function PipelineBoard({ vacancyId, filters, compact }: Props) {
  const { data: board, isLoading, error } = usePipeline(vacancyId, filters);
  const moveStage = useMoveStage(vacancyId);
  const isEmployer = useIsEmployer();

  // Intake activity badge — polled every 30s, rendered on the fleks_intake column.
  const { data: intakeStats } = useQuery<{ active: number; awaiting_human: number }>({
    queryKey: ["vacancy-intake-stats", vacancyId],
    queryFn: () => apiClient(`/api/intake/metrics/summary`),
    refetchInterval: 30_000,
    // Only fetch if there's a fleks_intake stage visible (forward-compatible guard).
    enabled: !!board?.stages.some((s) => s.slug === "fleks_intake"),
  });
  // Realtime: subscribe to pipeline updates from other users
  usePipelineSync(vacancyId);
  // Live cursors: show other users' cursor positions
  const { cursors, containerRef, emitMove } = useLiveCursors(vacancyId);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [placementAppId, setPlacementAppId] = useState<string | null>(null);

  if (isLoading || !board) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading board…</div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-sm text-rose-600">
        Kon pipeline niet laden: {(error as Error).message}
      </div>
    );
  }

  const totalApplications = board.stages.reduce(
    (sum, s) => sum + s.applications.length,
    0
  );

  if (totalApplications === 0) {
    return (
      <EmptyState
        icon={<Columns3 />}
        title="Geen kandidaten in deze pipeline"
        description="Voeg kandidaten toe aan deze vacature"
      />
    );
  }

  return (
    <>
      <DragDropProvider
        onDragEnd={(event) => {
          const source = event.operation.source;
          const target = event.operation.target;
          if (!source || !target) return;
          if (source.type !== "card") return;
          if (target.type !== "column") return;
          const applicationId = String(source.id);
          const toStageId = String(target.id);
          // Don't fire a mutation if the card ended up in its own column.
          const currentStage = board.stages.find((s) =>
            s.applications.some((a) => a.id === applicationId)
          );
          if (currentStage?.id === toStageId) return;
          moveStage.mutate({ applicationId, toStageId });
        }}
      >
        <div
          ref={containerRef}
          className={
            compact
              ? "relative flex gap-3 overflow-x-auto p-3 max-h-[400px]"
              : "relative flex gap-4 overflow-x-auto p-4 min-h-[70vh]"
          }
          data-testid="pipeline-board"
          onMouseMove={(e) => emitMove(e.nativeEvent)}
        >
          {board.stages.map((stage) => {
            const isIntakeColumn = stage.slug === "fleks_intake";
            const activeCount = isIntakeColumn && intakeStats
              ? (intakeStats.active ?? 0) + (intakeStats.awaiting_human ?? 0)
              : 0;
            return (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                labelOverride={
                  isEmployer && stage.name === "Sent to client"
                    ? "Sent to hiring manager"
                    : undefined
                }
                onCardClick={setSelectedCard}
                headerBadge={
                  isIntakeColumn && activeCount > 0 ? (
                    <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {activeCount} lopend
                    </span>
                  ) : undefined
                }
              />
            );
          })}
          {cursors.size > 0 && <LiveCursorsLayer cursors={cursors} />}
        </div>
      </DragDropProvider>
      <QualificationDrawer
        vacancyId={vacancyId}
        application={selectedCard}
        onClose={() => setSelectedCard(null)}
      />
      {/* Placement drawer — "Plaatsing aanmaken" for candidates in hired stage */}
      {(() => {
        const hiredStage = board.stages.find(
          (s) => s.name.toLowerCase().includes("aangenomen") || s.name.toLowerCase().includes("hired")
        );
        const isHired = hiredStage?.applications.some((a) => a.id === selectedCard?.id);
        if (selectedCard && isHired) {
          return (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                type="button"
                onClick={() => {
                  setPlacementAppId(selectedCard.id);
                  setSelectedCard(null);
                }}
                className="h-9 px-4 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 shadow-lg"
              >
                Plaatsing aanmaken
              </button>
            </div>
          );
        }
        return null;
      })()}
      <PlacementDrawer
        applicationId={placementAppId}
        onClose={() => setPlacementAppId(null)}
      />
    </>
  );
}
