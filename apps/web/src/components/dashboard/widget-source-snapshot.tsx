"use client";

import { BarChart3 } from "lucide-react";
import { useSourceSnapshotWidget } from "@/hooks/use-dashboard";
import { WidgetShell } from "./widget-shell";

/**
 * Widget 6 — Source snapshot.
 *
 * Renders a horizontal stacked bar list: one row per source with a
 * width-percentage bar (no chart library — plain div widths). The
 * backend already returns `percentage` per entry so the widget does
 * zero math beyond rendering.
 */

const SOURCE_LABEL: Record<string, string> = {
  indeed: "Indeed",
  marktplaats: "Marktplaats",
  linkedin: "LinkedIn",
  meta: "Meta",
  google: "Google",
  referral: "Referral",
  direct: "Direct",
  other: "Overig",
};

export function WidgetSourceSnapshot() {
  const q = useSourceSnapshotWidget();
  const rows = q.data?.bySource ?? [];

  return (
    <WidgetShell
      title="Kandidaatbronnen"
      icon={<BarChart3 className="size-4" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          Nog geen kandidaten ontvangen.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 5).map((r) => {
            const label = SOURCE_LABEL[r.source] ?? r.source;
            return (
              <li key={r.source} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">
                    {r.count}
                    <span className="ml-1 text-muted-foreground">
                      · {Math.round(r.percentage)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.min(100, r.percentage)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}
