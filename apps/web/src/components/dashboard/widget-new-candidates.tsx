"use client";

import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useNewCandidatesWidget } from "@/hooks/use-dashboard";
import { WidgetShell } from "./widget-shell";
import { cn } from "@/lib/utils";

/**
 * Widget 2 — New candidates today.
 *
 * Headline: today. Trend indicator: delta (today - yesterday), colour-coded
 * green/red/neutral. The delta is already computed server-side; the widget
 * simply picks the right glyph.
 */

export function WidgetNewCandidates() {
  const q = useNewCandidatesWidget();
  const data = q.data;
  const delta = data?.delta ?? 0;
  const trendColor =
    delta > 0
      ? "text-emerald-600"
      : delta < 0
      ? "text-red-600"
      : "text-muted-foreground";
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <WidgetShell
      title="Nieuwe kandidaten vandaag"
      icon={<Users className="size-4" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <div className="space-y-1">
        <div className="text-3xl font-bold">{data?.today ?? 0}</div>
        <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
          <TrendIcon className="size-3.5" />
          {delta > 0 ? `+${delta}` : delta} vs gisteren
        </div>
      </div>
    </WidgetShell>
  );
}
