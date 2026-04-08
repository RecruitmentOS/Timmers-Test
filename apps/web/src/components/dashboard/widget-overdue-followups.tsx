"use client";

import { AlertTriangle } from "lucide-react";
import { useOverdueFollowUpsWidget } from "@/hooks/use-dashboard";
import { WidgetShell } from "./widget-shell";

/**
 * Widget 3 — Overdue follow-ups.
 *
 * Headline: total. Secondary: up to the top five owners from byOwner,
 * each with count. Names come straight from the payload (ownerName) —
 * no extra user fetch.
 */

export function WidgetOverdueFollowups() {
  const q = useOverdueFollowUpsWidget();
  const data = q.data;
  const topOwners = (data?.byOwner ?? []).slice(0, 5);

  return (
    <WidgetShell
      title="Overdue follow-ups"
      icon={<AlertTriangle className="size-4" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <div className="space-y-2">
        <div className="text-3xl font-bold text-red-600">{data?.total ?? 0}</div>
        {topOwners.length > 0 ? (
          <ul className="space-y-1 text-xs">
            {topOwners.map((o) => (
              <li
                key={o.ownerId}
                className="flex items-center justify-between"
              >
                <span className="truncate text-muted-foreground">
                  {o.ownerName}
                </span>
                <span className="font-medium">{o.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground">
            Iedereen is bij — geen achterstand.
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
