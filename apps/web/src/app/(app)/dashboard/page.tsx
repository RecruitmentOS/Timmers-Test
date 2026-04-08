"use client";

import { WidgetOpenVacancies } from "@/components/dashboard/widget-open-vacancies";
import { WidgetNewCandidates } from "@/components/dashboard/widget-new-candidates";
import { WidgetOverdueFollowups } from "@/components/dashboard/widget-overdue-followups";
import { WidgetQualifiedThisWeek } from "@/components/dashboard/widget-qualified-this-week";
import { WidgetOpenTasks } from "@/components/dashboard/widget-open-tasks";
import { WidgetSourceSnapshot } from "@/components/dashboard/widget-source-snapshot";

/**
 * Dashboard page
 *
 * Grid of six independent widgets. Each widget owns its own data fetch
 * (via its own hook in use-dashboard.ts) and its own loading / error
 * state — the page itself does not read `session.role` or branch on
 * role, because the backend services in Plan 02-02 already scope
 * results by role on the server. The frontend just renders what it
 * gets.
 */

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overzicht van vandaag — vacatures, kandidaten en taken in één blik.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <WidgetOpenVacancies />
        <WidgetNewCandidates />
        <WidgetOverdueFollowups />
        <WidgetQualifiedThisWeek />
        <WidgetOpenTasks />
        <WidgetSourceSnapshot />
      </div>
    </div>
  );
}
