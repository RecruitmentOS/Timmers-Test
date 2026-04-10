"use client";

import { useBillingDashboard, usePortalSession } from "@/hooks/use-billing";
import { useMode } from "@/lib/use-mode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  Briefcase,
  ArrowRightLeft,
  ExternalLink,
  Info,
  AlertTriangle,
} from "lucide-react";
import type { BillingDashboard, BillingStatus } from "@recruitment-os/types";

// ==========================================
// Helpers
// ==========================================

function usagePercent(current: number, limit: number): number {
  if (limit <= 0 || !Number.isFinite(limit)) return 0;
  return Math.min(Math.round((current / limit) * 100), 100);
}

function progressColor(percent: number): string {
  if (percent > 90) return "bg-red-500";
  if (percent > 70) return "bg-yellow-500";
  return "bg-emerald-500";
}

function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
  };
  return map[tier] ?? tier;
}

function tierBadgeVariant(tier: string) {
  if (tier === "enterprise") return "default" as const;
  if (tier === "growth") return "secondary" as const;
  return "outline" as const;
}

function statusConfig(status: BillingStatus): {
  text: string;
  dotColor: string;
  textColor: string;
} {
  switch (status) {
    case "active":
      return { text: "Actief", dotColor: "bg-emerald-500", textColor: "text-emerald-600" };
    case "trialing":
      return { text: "Proefperiode", dotColor: "bg-blue-500", textColor: "text-blue-600" };
    case "past_due":
      return { text: "Achterstallig", dotColor: "bg-yellow-500", textColor: "text-yellow-600" };
    case "canceled":
      return { text: "Geannuleerd", dotColor: "bg-red-500", textColor: "text-red-600" };
    case "incomplete":
      return { text: "Incompleet", dotColor: "bg-yellow-500", textColor: "text-yellow-600" };
    default:
      return { text: String(status), dotColor: "bg-gray-400", textColor: "text-muted-foreground" };
  }
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ==========================================
// Usage card component
// ==========================================

function UsageCard({
  title,
  icon: Icon,
  current,
  limit,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  current: number;
  limit: number;
}) {
  const isUnlimited = !Number.isFinite(limit) || limit <= 0;
  const percent = isUnlimited ? 0 : usagePercent(current, limit);
  const color = isUnlimited ? "bg-emerald-500" : progressColor(percent);

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {title}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">
          {current}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            / {isUnlimited ? "Onbeperkt" : limit}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: isUnlimited ? "10%" : `${percent}%` }}
          />
        </div>
        {!isUnlimited && (
          <p className="mt-1 text-xs text-muted-foreground">
            {percent}% gebruikt
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ==========================================
// Billing page
// ==========================================

export default function BillingPage() {
  const { data: dashboard, isLoading, isError } = useBillingDashboard();
  const portalSession = usePortalSession();
  const mode = useMode();
  const isAgency = mode === "agency" || mode === null; // default to agency when mode unknown

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Facturatie</h1>
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error / dormant state
  if (isError || !dashboard) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Facturatie</h1>
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Info className="size-5 shrink-0 text-blue-500" />
            <p className="text-sm text-muted-foreground">
              Facturatie is nog niet ingesteld. Neem contact op met support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { usage, trialEndsAt, status, portalUrl } = dashboard;
  const { activeUsers, activeVacancies, placements, limits, planTier } = usage;
  const st = statusConfig(status);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Facturatie</h1>

      {/* Past due warning */}
      {status === "past_due" && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="size-5 shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Er is een openstaande betaling. Beheer je facturatie om dit op te
              lossen.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Usage cards */}
      <div
        className={`grid gap-4 ${isAgency ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}
      >
        <UsageCard
          title="Actieve gebruikers"
          icon={Users}
          current={activeUsers}
          limit={limits.maxUsers}
        />
        <UsageCard
          title="Actieve vacatures"
          icon={Briefcase}
          current={activeVacancies}
          limit={limits.maxActiveVacancies}
        />
        {isAgency && (
          <UsageCard
            title="Plaatsingen"
            icon={ArrowRightLeft}
            current={placements}
            limit={limits.maxPlacements}
          />
        )}
      </div>

      {/* Plan info */}
      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={tierBadgeVariant(planTier)}>
              {tierLabel(planTier)}
            </Badge>
            <span className="flex items-center gap-1.5 text-sm">
              <span className={`size-2 rounded-full ${st.dotColor}`} />
              <span className={st.textColor}>{st.text}</span>
            </span>
          </div>

          {/* Trial notice */}
          {trialEndsAt && status === "trialing" && (
            <p className="text-sm text-blue-600">
              Proefperiode tot {formatDate(trialEndsAt)} ({daysUntil(trialEndsAt)}{" "}
              dagen resterend)
            </p>
          )}

          {/* Stripe Customer Portal button */}
          <div className="pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      onClick={() => portalSession.mutate()}
                      disabled={portalUrl === null || portalSession.isPending}
                      className="gap-2"
                    />
                  }
                >
                  <ExternalLink className="size-4" />
                  Beheer facturatie
                </TooltipTrigger>
                {portalUrl === null && (
                  <TooltipContent>
                    Facturatie nog niet geconfigureerd
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
