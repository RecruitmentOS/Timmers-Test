"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { useOpenTasksWidget } from "@/hooks/use-dashboard";
import { WidgetShell } from "./widget-shell";

/**
 * Widget 5 — Open tasks.
 *
 * Headline: total. Secondary: an overdue sub-count rendered as a red
 * badge. The whole widget is a link to /tasks so recruiters can jump
 * into the list in one click.
 */

export function WidgetOpenTasks() {
  const q = useOpenTasksWidget();
  const data = q.data;

  return (
    <WidgetShell
      title="Open taken"
      icon={<ListChecks className="size-4" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <div className="space-y-2">
        <div className="text-3xl font-bold">{data?.total ?? 0}</div>
        <div className="flex items-center gap-2">
          {(data?.overdue ?? 0) > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              {data?.overdue} overdue
            </span>
          )}
          <Link
            href="/tasks"
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Bekijk alle taken →
          </Link>
        </div>
      </div>
    </WidgetShell>
  );
}
