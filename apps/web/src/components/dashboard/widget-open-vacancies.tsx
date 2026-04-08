"use client";

import { Briefcase } from "lucide-react";
import { useOpenVacanciesWidget } from "@/hooks/use-dashboard";
import { WidgetShell } from "./widget-shell";

/**
 * Widget 1 — Open vacancies.
 *
 * Headline: total. Secondary: a small pill row for byStatus
 * (draft / active / paused / closed) read directly from the widget payload.
 * All fields come from the rich OpenVacanciesWidget shape — no client math.
 */

const STATUS_LABEL: Record<string, string> = {
  draft: "Concept",
  active: "Actief",
  paused: "Gepauzeerd",
  closed: "Gesloten",
};

export function WidgetOpenVacancies() {
  const q = useOpenVacanciesWidget();
  const data = q.data;

  return (
    <WidgetShell
      title="Open vacatures"
      icon={<Briefcase className="size-4" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <div className="space-y-2">
        <div className="text-3xl font-bold">{data?.total ?? 0}</div>
        {data?.byStatus && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.byStatus).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                {STATUS_LABEL[status] ?? status}
                <span className="font-semibold text-foreground">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
