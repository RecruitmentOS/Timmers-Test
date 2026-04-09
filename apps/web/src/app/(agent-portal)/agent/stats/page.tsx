"use client";

import { useTranslations } from "next-intl";
import { AgentStatsWidget } from "@/components/agent/agent-stats-widget";

/**
 * Agent portal — "Stats" page.
 *
 * Shows personal stats widget with last-30-day aggregates.
 */
export default function AgentStatsPage() {
  const t = useTranslations("portal.agent");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("stats")}</h1>
        <p className="text-muted-foreground mt-1">
          Je persoonlijke prestaties van de afgelopen 30 dagen
        </p>
      </div>
      <AgentStatsWidget />
    </div>
  );
}
