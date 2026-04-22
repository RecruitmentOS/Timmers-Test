"use client";

import { useState, useMemo } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useMoveStage } from "@/hooks/use-applications";
import { QualificationDrawer } from "@/components/qualification/qualification-drawer";
import type { PipelineCard } from "@/hooks/use-pipeline";
import { cn } from "@/lib/utils";
import type { CandidateApplication } from "@recruitment-os/types";

type Stage = { id: string; name: string };

type Row = CandidateApplication & {
  candidate?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  vacancy?: { title: string } | null;
  stage?: { name: string } | null;
};

type Props = {
  stages: Stage[];
  rows: Row[];
};

const QUAL_DOT: Record<string, string> = {
  pending: "bg-slate-300",
  yes: "bg-emerald-500",
  maybe: "bg-amber-400",
  no: "bg-rose-500",
};

const QUAL_LABEL: Record<string, string> = {
  pending: "Open",
  yes: "Gekwalificeerd",
  maybe: "Mogelijk",
  no: "Afgewezen",
};

function rowToPipelineCard(row: Row): PipelineCard {
  return {
    id: row.id,
    candidateId: row.candidateId,
    currentStageId: row.currentStageId,
    ownerId: row.ownerId,
    qualificationStatus: row.qualificationStatus,
    sentToClient: row.sentToClient,
    sentToHiringManager: false,
    sourceDetail: row.sourceDetail,
    firstName: row.candidate?.firstName ?? null,
    lastName: row.candidate?.lastName ?? null,
    source: row.sourceDetail,
    hasOverdueTask: false,
    aiVerdict: null,
    aiConfidence: null,
    licenseBadges: null,
    distanceKm: null,
  };
}

export function CandidateKanban({ stages, rows }: Props) {
  const moveStage = useMoveStage();
  const [pendingMoves, setPendingMoves] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedRow = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;
  const selectedCard = selectedRow ? rowToPipelineCard(selectedRow) : null;

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const stage of stages) map.set(stage.id, []);
    map.set("__none__", []);

    for (const row of rows) {
      const targetId = pendingMoves[row.id] ?? row.currentStageId ?? "__none__";
      if (map.has(targetId)) {
        map.get(targetId)!.push(row);
      } else {
        map.get("__none__")!.push(row);
      }
    }
    return map;
  }, [rows, stages, pendingMoves]);

  function handleDragEnd(event: {
    operation: {
      source: { id: unknown; type: string } | null;
      target: { id: unknown; type: string } | null;
    };
  }) {
    const { source, target } = event.operation;
    if (!source || !target) return;
    if (source.type !== "kanban-card") return;
    if (target.type !== "kanban-column") return;

    const applicationId = String(source.id);
    const toStageId = String(target.id);

    const currentStageId =
      pendingMoves[applicationId] ??
      rows.find((r) => r.id === applicationId)?.currentStageId;

    if (currentStageId === toStageId) return;

    setPendingMoves((prev) => ({ ...prev, [applicationId]: toStageId }));

    moveStage.mutate(
      { id: applicationId, stageId: toStageId },
      {
        onError: () => {
          setPendingMoves((prev) => {
            const next = { ...prev };
            delete next[applicationId];
            return next;
          });
        },
        onSuccess: () => {
          setPendingMoves((prev) => {
            const next = { ...prev };
            delete next[applicationId];
            return next;
          });
        },
      }
    );
  }

  return (
    <>
      <DragDropProvider
        onDragEnd={
          handleDragEnd as Parameters<typeof DragDropProvider>[0]["onDragEnd"]
        }
      >
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              rows={grouped.get(stage.id) ?? []}
              onCardClick={setSelectedId}
            />
          ))}
        </div>
      </DragDropProvider>

      <QualificationDrawer
        vacancyId={selectedRow?.vacancyId ?? ""}
        application={selectedCard}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}

function KanbanColumn({
  stage,
  rows,
  onCardClick,
}: {
  stage: Stage;
  rows: Row[];
  onCardClick: (id: string) => void;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: stage.id,
    type: "kanban-column",
    accept: ["kanban-card"],
  });

  return (
    <div
      ref={ref as unknown as React.Ref<HTMLDivElement>}
      className={cn(
        "flex flex-col w-72 min-w-[272px] shrink-0 rounded-xl border transition-colors",
        isDropTarget
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <span className="text-sm font-semibold text-foreground">
          {stage.name}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {rows.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-2 flex-1 min-h-[120px]">
        {rows.map((row, index) => (
          <KanbanCard
            key={row.id}
            row={row}
            columnId={stage.id}
            index={index}
            onClick={() => onCardClick(row.id)}
          />
        ))}
        {rows.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/50">Geen kandidaten</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  row,
  columnId,
  index,
  onClick,
}: {
  row: Row;
  columnId: string;
  index: number;
  onClick: () => void;
}) {
  const { ref, isDragging } = useSortable({
    id: row.id,
    type: "kanban-card",
    group: columnId,
    index,
    accept: ["kanban-card"],
  });

  const firstName = row.candidate?.firstName ?? "";
  const lastName = row.candidate?.lastName ?? "";
  const name = `${firstName} ${lastName}`.trim() || "Onbekend";
  const initials =
    [firstName[0], lastName[0]].filter(Boolean).join("").toUpperCase() || "?";
  const qual = row.qualificationStatus ?? "pending";

  return (
    <button
      ref={ref as unknown as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3 shadow-sm",
        "cursor-grab active:cursor-grabbing hover:border-border hover:shadow-md transition-all",
        isDragging && "opacity-40 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="text-sm font-medium text-foreground truncate">
              {name}
            </p>
            <span
              className={cn(
                "inline-block h-2 w-2 shrink-0 rounded-full",
                QUAL_DOT[qual]
              )}
              title={QUAL_LABEL[qual]}
            />
          </div>

          {row.vacancy?.title && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {row.vacancy.title}
            </p>
          )}

          {row.sourceDetail && (
            <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {row.sourceDetail}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
