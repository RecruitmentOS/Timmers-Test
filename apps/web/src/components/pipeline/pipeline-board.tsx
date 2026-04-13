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
import {
  usePipeline,
  useMoveStage,
  type PipelineCard as CardType,
  type PipelineFilters,
} from "@/hooks/use-pipeline";
import { useIsEmployer } from "@/lib/use-mode";
import { PipelineColumn } from "./pipeline-column";
import { QualificationDrawer } from "@/components/qualification/qualification-drawer";
import { usePipelineSync } from "@/hooks/use-socket";
import { useLiveCursors } from "@/hooks/use-live-cursors";
import { LiveCursorsLayer } from "./live-cursors-layer";
import { EmptyState } from "@/components/empty-state";
import { Columns3 } from "lucide-react";

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
  // Realtime: subscribe to pipeline updates from other users
  usePipelineSync(vacancyId);
  // Live cursors: show other users' cursor positions
  const { cursors, containerRef, emitMove } = useLiveCursors(vacancyId);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);

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
          {board.stages.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              labelOverride={
                isEmployer && stage.name === "Sent to client"
                  ? "Sent to hiring manager"
                  : undefined
              }
              onCardClick={setSelectedCard}
            />
          ))}
          {cursors.size > 0 && <LiveCursorsLayer cursors={cursors} />}
        </div>
      </DragDropProvider>
      <QualificationDrawer
        vacancyId={vacancyId}
        application={selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </>
  );
}
