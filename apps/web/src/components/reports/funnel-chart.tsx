"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { FunnelStage } from "@recruitment-os/types";

interface FunnelChartProps {
  stages: FunnelStage[];
}

/**
 * FunnelChart — horizontal bar chart showing stage counts + conversion rates.
 * Uses recharts BarChart with layout="vertical" for a funnel-style visualization.
 */
export function FunnelChart({ stages }: FunnelChartProps) {
  if (!stages || stages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Geen trechterdata beschikbaar</p>
    );
  }

  const data = stages.map((s) => ({
    name: s.stageName,
    count: s.count,
    label: `${s.count} (${s.conversionRate}%)`,
  }));

  return (
    <ResponsiveContainer width="100%" height={stages.length * 40 + 40}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 60 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: number, _name: string, entry: { payload: { label: string } }) => [
            entry.payload.label,
            "Kandidaten",
          ]}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="label" position="right" style={{ fontSize: 11 }} />
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={`hsl(239, 84%, ${60 + index * 3}%)`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
