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
          className={
            compact
              ? "flex gap-3 overflow-x-auto p-3 max-h-[400px]"
              : "flex gap-4 overflow-x-auto p-4 min-h-[70vh]"
          }
          data-testid="pipeline-board"
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
