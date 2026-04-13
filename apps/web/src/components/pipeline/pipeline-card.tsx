"use client";

/**
 * Draggable pipeline card.
 *
 * `useSortable` from `@dnd-kit/react/sortable` lives here (isolation
 * rule — see pipeline-board.tsx header).
 */

import { memo } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { PipelineCard as CardType } from "@/hooks/use-pipeline";
import { LicenseBadges } from "@/components/driver/license-badges";
import { DistanceBadge } from "@/components/geo/distance-badge";
import { AIScreeningBadge } from "@/app/(app)/candidates/components/ai-screening-badge";

type Props = {
  application: CardType;
  columnId: string;
  index: number;
  onClick: () => void;
};

const QUAL_DOT: Record<CardType["qualificationStatus"], string> = {
  pending: "bg-slate-300",
  yes: "bg-emerald-500",
  maybe: "bg-amber-500",
  no: "bg-rose-500",
};

const QUAL_LABEL: Record<CardType["qualificationStatus"], string> = {
  pending: "Onbepaald",
  yes: "Gekwalificeerd",
  maybe: "Misschien",
  no: "Afgewezen",
};

export const PipelineCard = memo(function PipelineCard({
  application,
  columnId,
  index,
  onClick,
}: Props) {
  const { ref, isDragging } = useSortable({
    id: application.id,
    type: "card",
    group: columnId,
    index,
    accept: ["card"],
  });

  const name =
    [application.firstName, application.lastName]
      .filter(Boolean)
      .join(" ") || "Onbekend";

  return (
    <button
      ref={ref as unknown as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      data-application-id={application.id}
      data-testid={`pipeline-card-${application.id}`}
      className={`text-left bg-white rounded p-2 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-slate-300 transition-opacity ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800 truncate">
          {name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {application.aiVerdict && (
            <AIScreeningBadge
              verdict={application.aiVerdict}
              confidence={application.aiConfidence ?? undefined}
            />
          )}
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              QUAL_DOT[application.qualificationStatus]
            }`}
            title={QUAL_LABEL[application.qualificationStatus]}
            aria-label={QUAL_LABEL[application.qualificationStatus]}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
        {application.source && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100">
            {application.source}
          </span>
        )}
        {application.hasOverdueTask && (
          <span
            className="inline-flex items-center gap-1 text-rose-600"
            title="Overdue follow-up"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            overdue
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 mt-1 flex-wrap">
        {application.licenseBadges && application.licenseBadges.length > 0 && (
          <LicenseBadges badges={application.licenseBadges} compact />
        )}
        {application.distanceKm != null && (
          <DistanceBadge distanceKm={application.distanceKm} size="sm" />
        )}
      </div>
    </button>
  );
});
