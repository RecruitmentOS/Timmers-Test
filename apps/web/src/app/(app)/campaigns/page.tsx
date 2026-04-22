"use client";

import { useState, useMemo } from "react";
import { useQueryState } from "nuqs";
import { useCampaigns } from "@/hooks/use-campaigns";
import type { Campaign, CampaignChannel } from "@recruitment-os/types";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { CampaignDashboard } from "@/components/campaigns/campaign-dashboard";
import { AttributionTable } from "@/components/campaigns/attribution-table";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone,
  Play,
  Euro,
  MousePointerClick,
  Layers,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle kanalen" },
  { value: "meta", label: "Meta" },
  { value: "indeed", label: "Indeed" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "manual", label: "Handmatig" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle statussen" },
  { value: "draft", label: "Concept" },
  { value: "active", label: "Actief" },
  { value: "paused", label: "Gepauzeerd" },
  { value: "completed", label: "Afgerond" },
];

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  meta: "Meta",
  indeed: "Indeed",
  google: "Google",
  linkedin: "LinkedIn",
  manual: "Handmatig",
};

const CHANNEL_COLORS: Record<CampaignChannel, string> = {
  meta: "bg-blue-100 text-blue-700 ring-blue-200",
  indeed: "bg-violet-100 text-violet-700 ring-violet-200",
  google: "bg-red-100 text-red-700 ring-red-200",
  linkedin: "bg-sky-100 text-sky-700 ring-sky-200",
  manual: "bg-slate-100 text-slate-700 ring-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Concept",
  active: "Actief",
  paused: "Gepauzeerd",
  completed: "Afgerond",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
};

function formatEur(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface OverviewStats {
  active: number;
  totalSpend: number;
  totalClicks: number;
  activeChannels: number;
  totalBudget: number;
}

interface ChannelRow {
  channel: CampaignChannel;
  count: number;
  activeCampaigns: number;
  spendCents: number;
  budgetCents: number;
  clicks: number;
  budgetUsedPct: number;
}

function computeStats(campaigns: Campaign[]): OverviewStats {
  const channels = new Set<string>();
  let totalSpend = 0;
  let totalClicks = 0;
  let active = 0;
  let totalBudget = 0;

  for (const c of campaigns) {
    totalSpend += c.spendCents;
    totalClicks += c.clicks;
    if (c.status === "active") {
      active++;
      channels.add(c.channel);
    }
    if (c.budgetCents) totalBudget += c.budgetCents;
  }

  return {
    active,
    totalSpend,
    totalClicks,
    activeChannels: channels.size,
    totalBudget,
  };
}

function computeChannelBreakdown(campaigns: Campaign[]): ChannelRow[] {
  const map = new Map<CampaignChannel, ChannelRow>();

  for (const c of campaigns) {
    const existing = map.get(c.channel) ?? {
      channel: c.channel,
      count: 0,
      activeCampaigns: 0,
      spendCents: 0,
      budgetCents: 0,
      clicks: 0,
      budgetUsedPct: 0,
    };
    existing.count++;
    if (c.status === "active") existing.activeCampaigns++;
    existing.spendCents += c.spendCents;
    existing.budgetCents += c.budgetCents ?? 0;
    existing.clicks += c.clicks;
    map.set(c.channel, existing);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      budgetUsedPct:
        row.budgetCents > 0
          ? Math.min(100, Math.round((row.spendCents / row.budgetCents) * 100))
          : 0,
    }))
    .sort((a, b) => b.spendCents - a.spendCents);
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-4 shadow-sm ring-1 ring-border/60 flex items-start gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          accent
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-1">
          {label}
        </p>
        <p className="text-xl font-semibold text-foreground leading-none">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { data: allCampaigns, isLoading } = useCampaigns();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    null
  );

  const [channelFilter, setChannelFilter] = useQueryState("channel", {
    defaultValue: "all",
  });
  const [statusFilter, setStatusFilter] = useQueryState("status", {
    defaultValue: "all",
  });

  const campaigns = (allCampaigns ?? []).filter((c) => {
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const stats = useMemo(
    () => computeStats(allCampaigns ?? []),
    [allCampaigns]
  );
  const channelBreakdown = useMemo(
    () => computeChannelBreakdown(allCampaigns ?? []),
    [allCampaigns]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campagnes</h1>
          <p className="text-sm text-muted-foreground">
            Performance en uitgaven per wervingskanaal
          </p>
        </div>
        <CampaignForm vacancyId="" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Actieve campagnes"
          value={isLoading ? "–" : stats.active}
          sub={`van ${allCampaigns?.length ?? 0} totaal`}
          icon={<Play className="h-4 w-4 text-emerald-600" />}
          accent="bg-emerald-100"
        />
        <StatCard
          label="Totale uitgaven"
          value={isLoading ? "–" : formatEur(stats.totalSpend)}
          sub={
            stats.totalBudget > 0
              ? `van ${formatEur(stats.totalBudget)} budget`
              : "geen budget ingesteld"
          }
          icon={<Euro className="h-4 w-4 text-blue-600" />}
          accent="bg-blue-100"
        />
        <StatCard
          label="Totaal clicks"
          value={isLoading ? "–" : new Intl.NumberFormat("nl-NL").format(stats.totalClicks)}
          sub="alle actieve kanalen"
          icon={<MousePointerClick className="h-4 w-4 text-violet-600" />}
          accent="bg-violet-100"
        />
        <StatCard
          label="Actieve kanalen"
          value={isLoading ? "–" : stats.activeChannels}
          sub={`van ${CHANNEL_OPTIONS.length - 1} beschikbaar`}
          icon={<Layers className="h-4 w-4 text-amber-600" />}
          accent="bg-amber-100"
        />
      </div>

      {/* Channel breakdown */}
      {channelBreakdown.length > 0 && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Kanaaloverzicht</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium">Kanaal</th>
                    <th className="text-right px-4 py-3 font-medium">
                      Campagnes
                    </th>
                    <th className="text-right px-4 py-3 font-medium">
                      Uitgaven
                    </th>
                    <th className="text-right px-4 py-3 font-medium">Kliks</th>
                    <th className="px-6 py-3 font-medium w-48">
                      Budgetgebruik
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {channelBreakdown.map((row) => (
                    <tr
                      key={row.channel}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                              CHANNEL_COLORS[row.channel]
                            )}
                          >
                            {CHANNEL_LABELS[row.channel]}
                          </span>
                          {row.activeCampaigns > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                              {row.activeCampaigns} actief
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {row.count}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium">
                        {formatEur(row.spendCents)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {new Intl.NumberFormat("nl-NL").format(row.clicks)}
                      </td>
                      <td className="px-6 py-3.5">
                        {row.budgetCents > 0 ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={row.budgetUsedPct}
                              className="h-1.5 flex-1"
                            />
                            <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
                              {row.budgetUsedPct}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            –
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign list + detail */}
      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-6">
        {/* Left panel */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Kanaal</Label>
              <Select
                value={channelFilter}
                onValueChange={(v) => setChannelFilter(v)}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v)}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
            <CardContent className="p-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4">Laden...</p>
              ) : campaigns.length === 0 ? (
                <EmptyState
                  icon={<Megaphone />}
                  title="Geen campagnes gevonden"
                  description="Pas de filters aan of maak een nieuwe campagne aan"
                />
              ) : (
                <div className="divide-y divide-border/50">
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setSelectedCampaign(
                          selectedCampaign?.id === c.id ? null : c
                        )
                      }
                      className={cn(
                        "w-full text-left px-4 py-3.5 hover:bg-muted/40 transition-colors",
                        selectedCampaign?.id === c.id && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate text-foreground">
                            {c.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                                CHANNEL_COLORS[c.channel]
                              )}
                            >
                              {CHANNEL_LABELS[c.channel]}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[11px] px-1.5 py-0.5 h-auto",
                                STATUS_COLORS[c.status]
                              )}
                            >
                              {STATUS_LABELS[c.status]}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatEur(c.spendCents)}
                          </p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">
                            {new Intl.NumberFormat("nl-NL").format(c.clicks)}{" "}
                            kliks
                          </p>
                        </div>
                        {selectedCampaign?.id === c.id && (
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                      </div>
                      {c.budgetCents && c.budgetCents > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress
                            value={Math.min(
                              100,
                              Math.round(
                                (c.spendCents / c.budgetCents) * 100
                              )
                            )}
                            className="h-1 flex-1"
                          />
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {formatEur(c.budgetCents)}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-6">
          {selectedCampaign ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedCampaign.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        CHANNEL_COLORS[selectedCampaign.channel]
                      )}
                    >
                      {CHANNEL_LABELS[selectedCampaign.channel]}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        STATUS_COLORS[selectedCampaign.status]
                      )}
                    >
                      {STATUS_LABELS[selectedCampaign.status]}
                    </Badge>
                    {selectedCampaign.startDate && (
                      <span className="text-xs text-muted-foreground">
                        Gestart{" "}
                        {new Date(
                          selectedCampaign.startDate
                        ).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                  </div>
                </div>
                <CampaignForm
                  vacancyId={selectedCampaign.vacancyId}
                  campaign={selectedCampaign}
                  trigger={
                    <button className="text-sm text-primary hover:underline">
                      Bewerken
                    </button>
                  }
                />
              </div>

              <CampaignDashboard campaignId={selectedCampaign.id} />

              <Card className="border-0 shadow-md bg-gradient-to-br from-card to-card/70 backdrop-blur-sm ring-1 ring-border/60">
                <CardHeader>
                  <CardTitle className="text-base">
                    Gekoppelde sollicitaties
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AttributionTable campaignId={selectedCampaign.id} />
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Selecteer een campagne
              </p>
              <p className="text-xs text-muted-foreground max-w-48">
                Klik op een campagne om het dashboard en de gekoppelde
                sollicitaties te bekijken
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
