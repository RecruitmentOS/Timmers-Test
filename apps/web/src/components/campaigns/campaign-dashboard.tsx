"use client";

import {
  useCampaignMetrics,
  useCampaignApplications,
} from "@/hooks/use-campaigns";
import type { CampaignDashboardMetrics } from "@recruitment-os/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e0e7ff"];

function formatEur(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function KpiCard({
  label,
  value,
  isCurrency,
}: {
  label: string;
  value: number | null;
  isCurrency?: boolean;
}) {
  const display =
    value == null
      ? "-"
      : isCurrency
        ? formatEur(value)
        : new Intl.NumberFormat("nl-NL").format(value);

  return (
    <Card>
      <CardContent className="pt-4 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{display}</p>
      </CardContent>
    </Card>
  );
}

interface CampaignDashboardProps {
  campaignId: string;
}

export function CampaignDashboard({ campaignId }: CampaignDashboardProps) {
  const { data: metrics, isLoading } = useCampaignMetrics(campaignId);
  const { data: applications } = useCampaignApplications(campaignId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <p className="text-sm text-muted-foreground">
        Geen metriekdata beschikbaar
      </p>
    );
  }

  // Build daily chart data from applications
  const dailyData = buildDailyData(applications as any[] | undefined);
  const channelData = buildChannelBreakdown(applications as any[] | undefined);

  return (
    <div className="space-y-6">
      {/* KPI cards - primary metrics */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="Uitgaven" value={metrics.spend} isCurrency />
        <KpiCard label="Kliks" value={metrics.clicks} />
        <KpiCard label="Sollicitaties" value={metrics.applications} />
        <KpiCard label="Gekwalificeerd" value={metrics.qualified} />
        <KpiCard label="Aangenomen" value={metrics.hired} />
      </div>

      {/* Cost metrics row */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Kosten per sollicitatie"
          value={metrics.costPerApplication}
          isCurrency
        />
        <KpiCard
          label="Kosten per gekwalificeerd"
          value={metrics.costPerQualified}
          isCurrency
        />
        <KpiCard
          label="Kosten per hire"
          value={metrics.costPerHire}
          isCurrency
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Daily spend + applications bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Dagelijkse uitgaven & sollicitaties
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    yAxisId="left"
                    dataKey="spend"
                    fill="#6366f1"
                    name="Uitgaven (EUR)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="applications"
                    fill="#22c55e"
                    name="Sollicitaties"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nog geen dagelijkse data
              </p>
            )}
          </CardContent>
        </Card>

        {/* Attribution pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Sollicitaties per bron
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry: any) =>
                      `${entry.name}: ${entry.value}`
                    }
                  >
                    {channelData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nog geen brondata
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Build daily aggregation from applications list */
function buildDailyData(
  applications: Array<Record<string, unknown>> | undefined
) {
  if (!applications?.length) return [];
  const byDate: Record<string, { spend: number; applications: number }> = {};
  for (const app of applications) {
    const date =
      typeof app.createdAt === "string"
        ? app.createdAt.slice(0, 10)
        : "unknown";
    if (!byDate[date]) byDate[date] = { spend: 0, applications: 0 };
    byDate[date].applications += 1;
  }
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));
}

/** Build channel breakdown from applications */
function buildChannelBreakdown(
  applications: Array<Record<string, unknown>> | undefined
) {
  if (!applications?.length) return [];
  const bySource: Record<string, number> = {};
  for (const app of applications) {
    const source = (app.sourceDetail as string) || "Onbekend";
    bySource[source] = (bySource[source] || 0) + 1;
  }
  return Object.entries(bySource).map(([name, value]) => ({ name, value }));
}
