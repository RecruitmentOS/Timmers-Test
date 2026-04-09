"use client";

import { Suspense } from "react";
import { useReport, useDownloadCSV } from "@/hooks/use-reports";
import { ReportWidget } from "@/components/reports/report-widget";
import { FunnelChart } from "@/components/reports/funnel-chart";
import {
  TimePeriodPicker,
  useTimePeriodParams,
} from "@/components/reports/time-period-picker";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  TotalCandidatesReport,
  QualifiedCandidatesReport,
  StageFunnelReport,
  TimeToFirstContactReport,
  SourceBreakdownReport,
  OwnerActivityReport,
} from "@recruitment-os/types";

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

/**
 * Reports page — standalone /reports route per D-13.
 * 7 widgets in a responsive grid with global time-period picker.
 * CSV export per widget. Role scoping happens server-side.
 */
export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageInner />
    </Suspense>
  );
}

function ReportsPageInner() {
  const params = useTimePeriodParams();
  const downloadCSV = useDownloadCSV();

  // 6 report queries (stage-funnel provides the 7th visual via per-vacancy tabs)
  const totalCandidates = useReport<TotalCandidatesReport[]>("total-candidates", params);
  const qualifiedCandidates = useReport<QualifiedCandidatesReport[]>("qualified-candidates", params);
  const stageFunnel = useReport<StageFunnelReport[]>("stage-funnel", params);
  const timeToFirstContact = useReport<TimeToFirstContactReport[]>("time-to-first-contact", params);
  const sourceBreakdown = useReport<SourceBreakdownReport>("source-breakdown", params);
  const ownerActivity = useReport<OwnerActivityReport[]>("owner-activity", params);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rapportages</h1>
          <p className="text-sm text-muted-foreground">
            Historische analyse van recruitmentprestaties per vacature en organisatiebreed.
          </p>
        </div>
        <TimePeriodPicker />
      </div>

      {/* Widget grid — 2 cols on lg, 1 on mobile */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Widget 1: Total candidates (RPT-01) */}
        <ReportWidget
          title="Totaal kandidaten"
          isLoading={totalCandidates.isLoading}
          error={totalCandidates.error}
          onRetry={() => totalCandidates.refetch()}
          onExport={() => downloadCSV("total-candidates", params)}
        >
          {totalCandidates.data && totalCandidates.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vacature</TableHead>
                  <TableHead className="text-right">Aantal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totalCandidates.data.map((r) => (
                  <TableRow key={r.vacancyId}>
                    <TableCell>{r.vacancyTitle}</TableCell>
                    <TableCell className="text-right font-medium">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Geen data voor deze periode</p>
          )}
        </ReportWidget>

        {/* Widget 2: Qualified candidates (RPT-02) */}
        <ReportWidget
          title="Gekwalificeerde kandidaten"
          isLoading={qualifiedCandidates.isLoading}
          error={qualifiedCandidates.error}
          onRetry={() => qualifiedCandidates.refetch()}
          onExport={() => downloadCSV("qualified-candidates", params)}
        >
          {qualifiedCandidates.data && qualifiedCandidates.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vacature</TableHead>
                  <TableHead className="text-right">Ja</TableHead>
                  <TableHead className="text-right">Misschien</TableHead>
                  <TableHead className="text-right">Nee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualifiedCandidates.data.map((r) => (
                  <TableRow key={r.vacancyId}>
                    <TableCell>{r.vacancyTitle}</TableCell>
                    <TableCell className="text-right font-medium text-green-600">{r.qualified}</TableCell>
                    <TableCell className="text-right font-medium text-amber-600">{r.maybe}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">{r.rejected}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Geen data voor deze periode</p>
          )}
        </ReportWidget>

        {/* Widget 3: Stage funnel (RPT-03) */}
        <ReportWidget
          title="Fase-trechter"
          isLoading={stageFunnel.isLoading}
          error={stageFunnel.error}
          onRetry={() => stageFunnel.refetch()}
          onExport={() => downloadCSV("stage-funnel", params)}
        >
          {stageFunnel.data && stageFunnel.data.length > 0 ? (
            <Tabs defaultValue={stageFunnel.data[0]?.vacancyId}>
              <TabsList className="mb-2">
                {stageFunnel.data.map((r) => (
                  <TabsTrigger key={r.vacancyId} value={r.vacancyId} className="text-xs">
                    {r.vacancyTitle}
                  </TabsTrigger>
                ))}
              </TabsList>
              {stageFunnel.data.map((r) => (
                <TabsContent key={r.vacancyId} value={r.vacancyId}>
                  <FunnelChart stages={r.stages} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground">Geen trechterdata voor deze periode</p>
          )}
        </ReportWidget>

        {/* Widget 4: Time to first contact (RPT-04) */}
        <ReportWidget
          title="Tijd tot eerste contact"
          isLoading={timeToFirstContact.isLoading}
          error={timeToFirstContact.error}
          onRetry={() => timeToFirstContact.refetch()}
          onExport={() => downloadCSV("time-to-first-contact", params)}
        >
          {timeToFirstContact.data && timeToFirstContact.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vacature</TableHead>
                  <TableHead className="text-right">Gem. uren</TableHead>
                  <TableHead className="text-right">Mediaan uren</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeToFirstContact.data.map((r) => (
                  <TableRow key={r.vacancyId}>
                    <TableCell>{r.vacancyTitle}</TableCell>
                    <TableCell className="text-right font-medium">{r.avgHours}</TableCell>
                    <TableCell className="text-right font-medium">{r.medianHours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Geen data voor deze periode</p>
          )}
        </ReportWidget>

        {/* Widget 5: Source breakdown (RPT-05) */}
        <ReportWidget
          title="Bronverdeling"
          isLoading={sourceBreakdown.isLoading}
          error={sourceBreakdown.error}
          onRetry={() => sourceBreakdown.refetch()}
          onExport={() => downloadCSV("source-breakdown", params)}
        >
          {sourceBreakdown.data && sourceBreakdown.data.entries.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={sourceBreakdown.data.entries}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={(entry: { source: string; percentage: number }) =>
                    `${entry.source} (${entry.percentage}%)`
                  }
                >
                  {sourceBreakdown.data.entries.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Geen brondata voor deze periode</p>
          )}
        </ReportWidget>

        {/* Widget 6: Owner activity (RPT-06) */}
        <ReportWidget
          title="Activiteit per eigenaar"
          isLoading={ownerActivity.isLoading}
          error={ownerActivity.error}
          onRetry={() => ownerActivity.refetch()}
          onExport={() => downloadCSV("owner-activity", params)}
        >
          {ownerActivity.data && ownerActivity.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead className="text-right">Verwerkt</TableHead>
                  <TableHead className="text-right">Taken</TableHead>
                  <TableHead className="text-right">Kwalif.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ownerActivity.data.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell>{r.userName}</TableCell>
                    <TableCell className="text-right">{r.candidatesProcessed}</TableCell>
                    <TableCell className="text-right">{r.tasksCompleted}</TableCell>
                    <TableCell className="text-right">{r.qualificationsGiven}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Geen activiteitdata voor deze periode</p>
          )}
        </ReportWidget>
      </div>
    </div>
  );
}
