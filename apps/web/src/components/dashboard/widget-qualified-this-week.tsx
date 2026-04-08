"use client";

import { CheckCircle2 } from "lucide-react";
import { useQualifiedThisWeekWidget } from "@/hooks/use-dashboard";
import { WidgetShell } from "./widget-shell";

/**
 * Widget 4 — Qualified this week.
 *
 * Headline: total. Visual: inline SVG sparkline built from byDay. No
 * chart library dependency — the SVG polyline is computed directly
 * from the seven-day series.
 *
 * The sparkline normalises its own Y range so a low-volume week still
 * reads as a shape rather than a flat line.
 */

function Sparkline({
  points,
  width = 140,
  height = 36,
}: {
  points: Array<{ day: string; count: number }>;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points
    .map((p, i) => {
      const x = i * step;
      const y = height - (p.count / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

export function WidgetQualifiedThisWeek() {
  const q = useQualifiedThisWeekWidget();
  const data = q.data;

  return (
    <WidgetShell
      title="Gekwalificeerd deze week"
      icon={<CheckCircle2 className="size-4" />}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
    >
      <div className="flex items-end justify-between gap-2">
        <div className="text-3xl font-bold">{data?.total ?? 0}</div>
        <div className="text-emerald-600">
          <Sparkline points={data?.byDay ?? []} />
        </div>
      </div>
    </WidgetShell>
  );
}
