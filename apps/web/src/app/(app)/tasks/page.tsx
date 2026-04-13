"use client";

import { useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { Plus, CheckSquare } from "lucide-react";
import type { Task, TaskFilters, TaskStatus } from "@recruitment-os/types";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  useTasks,
  useCompleteTask,
  useDeleteTask,
} from "@/hooks/use-tasks";
import { useVacancies } from "@/hooks/use-vacancies";
import { TaskFilters as TaskFiltersBar } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";

/**
 * Taken (Tasks) page
 *
 * Filters are URL-bound via nuqs (same keys as `task-filters.tsx`). The
 * "Alleen overdue" toggle is derived: when ON we set `dueBefore=now()`
 * and force `status=open` — no separate backend flag needed. Per 02-CONTEXT.md
 * overdue = status='open' AND dueDate < now().
 *
 * New-task creation is intentionally stubbed for this plan; the modal
 * wiring is a follow-up plan.
 */

export default function TasksPage() {
  const [assignedTo] = useQueryState("assignedTo");
  const [statusQ] = useQueryState("status");
  const [vacancyId] = useQueryState("vacancyId");
  const [dueBeforeQ] = useQueryState("dueBefore");
  const [dueAfterQ] = useQueryState("dueAfter");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const filters = useMemo<TaskFilters>(() => {
    const status: TaskStatus = (statusQ as TaskStatus) || "open";
    const base: TaskFilters = {
      assignedTo: assignedTo ?? undefined,
      status,
      vacancyId: vacancyId ?? undefined,
      dueBefore: dueBeforeQ ?? undefined,
      dueAfter: dueAfterQ ?? undefined,
    };
    if (overdueOnly) {
      // Overdue = open + dueDate < now(). If the user also set a `dueBefore`,
      // take the earlier of the two. `dueAfter` is left untouched.
      const nowIso = new Date().toISOString();
      const earliest =
        base.dueBefore && new Date(base.dueBefore) < new Date(nowIso)
          ? base.dueBefore
          : nowIso;
      return { ...base, status: "open", dueBefore: earliest };
    }
    return base;
  }, [assignedTo, statusQ, vacancyId, dueBeforeQ, dueAfterQ, overdueOnly]);

  const {
    data: tasks = [],
    isLoading,
    error,
    refetch,
  } = useTasks(filters);

  const { data: vacancies = [] } = useVacancies();

  // TODO(02-04): wire per-org users endpoint for the assignee dropdown.
  // Until then we surface only assignees we already see in the task list.
  const usersFromTasks = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const t of tasks) {
      if (!seen.has(t.assignedToUserId)) {
        seen.set(t.assignedToUserId, {
          id: t.assignedToUserId,
          name: t.assignedToUserId.slice(0, 8),
        });
      }
    }
    return Array.from(seen.values());
  }, [tasks]);

  const vacancyOptions = vacancies.map((v) => ({ id: v.id, title: v.title }));

  const completeMut = useCompleteTask();
  const deleteMut = useDeleteTask();

  function handleComplete(id: string) {
    completeMut.mutate({ id });
  }

  function handleEdit(_task: Task) {
    // TODO(02-04): wire edit modal in follow-up.
  }

  function handleDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Taak verwijderen?"))
      return;
    deleteMut.mutate({ id });
  }

  const counts = useMemo(() => {
    const now = Date.now();
    let overdue = 0;
    let open = 0;
    let completed = 0;
    for (const t of tasks) {
      if (t.status === "completed") {
        completed++;
        continue;
      }
      open++;
      if (t.dueDate && new Date(t.dueDate).getTime() < now) overdue++;
    }
    return { overdue, open, completed };
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Taken</h1>
          <p className="text-sm text-muted-foreground">
            {counts.open} open · {counts.overdue} overdue · {counts.completed}{" "}
            voltooid
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            // TODO(02-04): wire new-task modal in follow-up
          }}
        >
          <Plus className="mr-1.5 size-4" />
          Nieuwe taak
        </Button>
      </div>

      <div className="space-y-3">
        <TaskFiltersBar users={usersFromTasks} vacancies={vacancyOptions} />
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Alleen overdue
          </label>
        </div>
      </div>

      {!isLoading && !error && tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare />}
          title="Geen taken"
          description="Je hebt geen openstaande taken"
        />
      ) : (
        <TaskList
          tasks={tasks}
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
          onComplete={handleComplete}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
