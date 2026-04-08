"use client";

/**
 * Droppable column for the pipeline board.
 *
 * Column is a pure drop zone — it does not participate in sortable
 * ordering. `useDroppable` from `@dnd-kit/react` lives here (isolation
 * rule — see pipeline-board.tsx header).
 */

import { useDroppable } from "@dnd-kit/react";
import type {
  PipelineStage,
  PipelineCard as CardType,
} from "@/hooks/use-pipeline";
import { PipelineCard } from "./pipeline-card";

type Props = {
  stage: PipelineStage;
  /**
   * Employer-mode label override — pipeline-board.tsx computes this
   * via useIsEmployer() and passes it in so this component stays
   * mode-agnostic.
   */
  labelOverride?: string;
  onCardClick: (card: CardType) => void;
};

export function PipelineColumn({
  stage,
  labelOverride,
  onCardClick,
}: Props) {
  const { ref, isDropTarget } = useDroppable({
    id: stage.id,
    type: "column",
    accept: ["card"],
  });

  return (
    <div
      ref={ref as unknown as React.Ref<HTMLDivElement>}
      data-stage-id={stage.id}
      data-testid={`pipeline-column-${stage.id}`}
      className={`flex flex-col gap-2 w-72 shrink-0 rounded p-2 border transition-colors ${
        isDropTarget
          ? "bg-blue-50 border-blue-300"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between px-1 py-2">
        <h3 className="text-sm font-semibold text-slate-700">
          {labelOverride ?? stage.name}
        </h3>
        <span className="text-xs text-slate-500">
          {stage.applications.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[60px]">
        {stage.applications.map((app, index) => (
          <PipelineCard
            key={app.id}
            application={app}
            columnId={stage.id}
            index={index}
            onClick={() => onCardClick(app)}
          />
        ))}
      </div>
    </div>
  );
}
