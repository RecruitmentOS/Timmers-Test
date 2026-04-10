"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import {
  useAgentTasks,
  useAgentCompleteTask,
  type AgentTask,
} from "@/hooks/use-agent-portal";
import { cn } from "@/lib/utils";

/**
 * Check whether a task is overdue (due date in the past and still open).
 */
function isOverdue(task: AgentTask): boolean {
  if (!task.dueDate || task.status === "completed") return false;
  return new Date(task.dueDate) < new Date();
}

/**
 * Format a date for display using the user's locale preference.
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const locale =
    typeof document !== "undefined" &&
    document.cookie.includes("NEXT_LOCALE=en")
      ? "en-GB"
      : "nl-NL";
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Single task row with completion button and overdue highlighting.
 */
function TaskRow({ task }: { task: AgentTask }) {
  const completeTask = useAgentCompleteTask();
  const overdue = isOverdue(task);
  const isCompleted = task.status === "completed";

  function handleComplete() {
    if (isCompleted) return;
    completeTask.mutate(task.id);
  }

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-3 border-b last:border-b-0 transition-opacity",
        overdue && "bg-red-50 dark:bg-red-950/20",
        isCompleted && "opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          ) : overdue ? (
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span
            className={cn(
              "font-semibold text-sm truncate",
              isCompleted && "line-through"
            )}
          >
            {task.title}
          </span>
          <Badge
            variant={
              task.priority === "urgent"
                ? "destructive"
                : task.priority === "high"
                  ? "destructive"
                  : "secondary"
            }
            className="text-xs"
          >
            {task.priority}
          </Badge>
        </div>
        {task.dueDate && (
          <p
            className={cn(
              "text-sm mt-0.5 ml-6",
              overdue ? "text-red-600 font-medium" : "text-muted-foreground"
            )}
          >
            {overdue ? "Verlopen: " : "Deadline: "}
            {formatDate(task.dueDate)}
          </p>
        )}
      </div>

      {!isCompleted && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleComplete}
          disabled={completeTask.isPending}
          className="shrink-0"
        >
          Voltooien
        </Button>
      )}
    </li>
  );
}

/**
 * AgentTaskList — simple task list for the agent portal.
 * Shows open tasks first, then completed. Overdue tasks highlighted in red.
 */
export function AgentTaskList() {
  const { data: tasks, isLoading, error } = useAgentTasks();
  const t = useTranslations("portal.agent");

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        Er is een fout opgetreden bij het laden van taken.
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">Geen taken</p>
        <p className="text-sm mt-1">Je hebt momenteel geen openstaande taken.</p>
      </div>
    );
  }

  // Sort: open tasks first (overdue on top), then completed
  const sorted = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.status === "open") {
      const aOverdue = isOverdue(a);
      const bOverdue = isOverdue(b);
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    }
    return 0;
  });

  return (
    <ul className="divide-y divide-border rounded-lg border bg-card">
      {sorted.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </ul>
  );
}
