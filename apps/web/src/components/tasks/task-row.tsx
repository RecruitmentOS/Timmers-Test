"use client";

import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, Pencil } from "lucide-react";
import type { Task, TaskPriority } from "@recruitment-os/types";
import { cn } from "@/lib/utils";

/**
 * TaskRow
 *
 * Pure presentational row. The row computes `isOverdue` from
 * `task.dueDate < now()` so timezone drift is handled at render time
 * (no hardcoded threshold). Overdue rows get `bg-red-50 border-l-4
 * border-red-500`.
 *
 * Field rules (from @recruitment-os/types):
 *   - task.assignedToUserId   (NOT task.ownerId)
 *   - task.organizationId     (NOT task.orgId)
 *   - task.priority enum: "low" | "medium" | "high" | "urgent"
 *     (NO "normal" value)
 */

type Props = {
  task: Task;
  onComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
};

const PRIORITY_VARIANT: Record<TaskPriority, "secondary" | "outline" | "default" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Laag",
  medium: "Gemiddeld",
  high: "Hoog",
  urgent: "Urgent",
};

export function TaskRow({ task, onComplete, onEdit, onDelete }: Props) {
  // Overdue rule from 02-CONTEXT.md: due_date < now() AND status = 'open'.
  const isOverdue =
    task.status === "open" &&
    !!task.dueDate &&
    new Date(task.dueDate) < new Date();

  const isCompleted = task.status === "completed";

  const relatedLabel = task.candidateId
    ? `Kandidaat · ${task.candidateId.slice(0, 8)}`
    : task.vacancyId
    ? `Vacature · ${task.vacancyId.slice(0, 8)}`
    : task.clientId
    ? `Klant · ${task.clientId.slice(0, 8)}`
    : "—";

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_1fr_auto_auto_auto_auto] items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
        isOverdue && "bg-red-50 border-l-4 border-red-500",
        isCompleted && "opacity-60"
      )}
      data-overdue={isOverdue || undefined}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(next) => {
          if (next === true && !isCompleted) onComplete(task.id);
        }}
        disabled={isCompleted}
        aria-label={`Markeer "${task.title}" als voltooid`}
      />

      <div className="min-w-0">
        <div className={cn("truncate font-medium", isCompleted && "line-through")}>
          {task.title}
        </div>
        {task.description && (
          <div className="truncate text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
      </div>

      <div className="truncate text-xs text-muted-foreground">{relatedLabel}</div>

      <div className="flex items-center gap-1.5 text-xs">
        {task.dueDate ? (
          <>
            {isOverdue && (
              <span
                className="inline-block size-2 rounded-full bg-red-500"
                aria-hidden
              />
            )}
            <span className={cn(isOverdue && "text-red-700 font-medium")}>
              {format(new Date(task.dueDate), "d MMMM yyyy", { locale: nl })}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Geen deadline</span>
        )}
      </div>

      <Badge variant={PRIORITY_VARIANT[task.priority]}>
        {PRIORITY_LABEL[task.priority]}
      </Badge>

      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground"
        title={task.assignedToUserId}
      >
        {task.assignedToUserId.slice(0, 2)}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(task)}
          aria-label="Bewerken"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(task.id)}
          aria-label="Verwijderen"
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Meer">
          <MoreHorizontal className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
