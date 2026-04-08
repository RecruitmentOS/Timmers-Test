"use client";

import { Button } from "@/components/ui/button";
import { ArrowRightLeft, XCircle, UserPlus, Tag } from "lucide-react";

/**
 * BulkActionToolbar
 *
 * Sticky floating pill that appears when the user has at least one row
 * selected. Exposes four bulk action buttons — clicking any one of them
 * does NOT fire a mutation directly. Instead it opens the
 * BulkConfirmationModal in the matching mode via `onOpenMode`.
 *
 * CRITICAL scope rule: this component has NO awareness of the by-IDs
 * vs by-matching-criteria transport paths. That discrimination lives
 * only in `useBulkActionsHandler`. All this toolbar knows is the
 * selected count.
 */
export type BulkMode = "move" | "reject" | "assign" | "tag";

type Props = {
  selectedCount: number;
  isAllMatchingSelected: boolean;
  totalMatching: number;
  onOpenMode: (mode: BulkMode) => void;
  onClearSelection: () => void;
};

export function BulkActionToolbar({
  selectedCount,
  isAllMatchingSelected,
  totalMatching,
  onOpenMode,
  onClearSelection,
}: Props) {
  if (selectedCount <= 0) return null;

  const displayCount = isAllMatchingSelected ? totalMatching : selectedCount;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm shadow-lg ring-1 ring-foreground/10">
        <span className="mr-2 font-medium">
          {displayCount} geselecteerd
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenMode("move")}
        >
          <ArrowRightLeft className="mr-1.5 size-3.5" />
          Verplaatsen
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenMode("reject")}
        >
          <XCircle className="mr-1.5 size-3.5" />
          Afwijzen
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenMode("assign")}
        >
          <UserPlus className="mr-1.5 size-3.5" />
          Toewijzen
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => onOpenMode("tag")}
        >
          <Tag className="mr-1.5 size-3.5" />
          Label toevoegen
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          Sluiten
        </Button>
      </div>
    </div>
  );
}
