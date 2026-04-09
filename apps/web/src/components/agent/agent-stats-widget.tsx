"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Award, CheckCircle2 } from "lucide-react";
import { useAgentStats } from "@/hooks/use-agent-portal";

/**
 * AgentStatsWidget — personal dashboard with three stat cards.
 *
 * Per D-12: one-widget personal dashboard showing:
 * - Kandidaten toegevoegd (candidatesAdded)
 * - Gekwalificeerd (qualified)
 * - Taken voltooid (tasksCompleted)
 *
 * Time period: last 30 days (hardcoded for simplicity).
 */
export function AgentStatsWidget() {
  const t = useTranslations("portal.agent");

  // Last 30 days
  const endDate = new Date().toISOString();
  const startDate = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: stats, isLoading } = useAgentStats(startDate, endDate);

  const cards = [
    {
      label: "Kandidaten toegevoegd",
      value: stats?.candidatesAdded ?? 0,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Gekwalificeerd",
      value: stats?.qualified ?? 0,
      icon: Award,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
    {
      label: "Taken voltooid",
      value: stats?.tasksCompleted ?? 0,
      icon: CheckCircle2,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
            <div className={`rounded-md p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-3xl font-bold">{card.value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Laatste 30 dagen
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
