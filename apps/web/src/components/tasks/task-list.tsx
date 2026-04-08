"use client";

import type { Task } from "@recruitment-os/types";
import { Button } from "@/components/ui/button";
import { TaskRow } from "./task-row";

/**
 * TaskList
 *
 * Wraps a list of TaskRow components. Handles loading / error / empty
 * states. Sort order (per 02-04-PLAN.md Step 4):
 *   1. Overdue first     — by dueDate ascending
 *   2. Then open         — by dueDate ascending (nulls last)
 *   3. Then completed    — by completedAt descending (nulls last)
 */

type Props = {
  tasks: Task[];
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  onComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
};

function bucketOf(t: Task): 0 | 1 | 2 {
  if (t.status === "completed") return 2;
  const now = Date.now();
  if (t.dueDate && new Date(t.dueDate).getTime() < now) return 0; // overdue
  return 1; // open, not overdue
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ba = bucketOf(a);
    const bb = bucketOf(b);
    if (ba !== bb) return ba - bb;

    if (ba === 2) {
      // Completed — most recent first
      const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return tb - ta;
    }

    // Overdue + Open — due date ascending, nulls last
    const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

export function TaskList({
  tasks,
  isLoading,
  error,
  onRetry,
  onComplete,
  onEdit,
  onDelete,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : "Er ging iets mis bij het laden van taken.";
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="text-sm font-medium text-destructive">
          Kon taken niet laden
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={onRetry}
          >
            Opnieuw proberen
          </Button>
        )}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Geen taken gevonden. Probeer een andere filter of maak een nieuwe taak aan.
      </div>
    );
  }

  const sorted = sortTasks(tasks);

  return (
    <div className="space-y-2">
      {sorted.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onComplete={onComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
