"use client";

import { WidgetOpenVacancies } from "@/components/dashboard/widget-open-vacancies";
import { WidgetNewCandidates } from "@/components/dashboard/widget-new-candidates";
import { WidgetOverdueFollowups } from "@/components/dashboard/widget-overdue-followups";
import { WidgetQualifiedThisWeek } from "@/components/dashboard/widget-qualified-this-week";
import { WidgetOpenTasks } from "@/components/dashboard/widget-open-tasks";
import { WidgetSourceSnapshot } from "@/components/dashboard/widget-source-snapshot";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welkomstbanner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary/90 to-indigo-400 p-6 text-primary-foreground shadow-lg shadow-primary/20">
        {/* Decoratieve cirkels */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-6 right-12 h-32 w-32 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute bottom-4 right-4 h-16 w-16 rounded-full bg-white/8" />

        <div className="relative z-10">
          <h1 className="text-xl font-semibold">Goedemorgen 👋</h1>
          <p className="mt-1 text-sm text-primary-foreground/75">
            Hier is je overzicht van vandaag — vacatures, kandidaten en taken in één blik.
          </p>
        </div>
      </div>

      {/* Widget grid */}
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
