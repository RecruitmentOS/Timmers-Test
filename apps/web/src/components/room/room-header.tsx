// apps/web/src/components/room/room-header.tsx
"use client";

import { useRoomStats } from "@/hooks/use-room-stats";
import { PresenceAvatars } from "@/components/collaboration/presence-avatars";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import type { Vacancy } from "@recruitment-os/types";

function StatCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  variant?: "default" | "warning";
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon
        className={`size-4 ${variant === "warning" ? "text-amber-500" : "text-muted-foreground"}`}
      />
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export function RoomHeader({
  vacancy,
  vacancyId,
}: {
  vacancy: Vacancy;
  vacancyId: string;
}) {
  const { data: stats, isLoading } = useRoomStats(vacancyId);

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      {/* Top row: title + presence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{vacancy.title}</h1>
          <Badge variant="outline" className="text-xs">
            {vacancy.status}
          </Badge>
          {vacancy.location && (
            <span className="text-sm text-muted-foreground">
              {vacancy.location}
            </span>
          )}
        </div>
        <PresenceAvatars vacancyId={vacancyId} />
      </div>

      {/* Stats bar */}
      <div className="mt-2 flex items-center gap-6">
        {isLoading ? (
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-20" />
            ))}
          </div>
        ) : stats ? (
          <>
            <StatCard icon={Users} label="totaal" value={stats.total} />
            <StatCard
              icon={CheckCircle2}
              label="geschikt"
              value={stats.qualified}
            />
            <StatCard icon={Calendar} label="interview" value={stats.interview} />
            <StatCard
              icon={AlertTriangle}
              label="overdue"
              value={stats.overdue}
              variant={stats.overdue > 0 ? "warning" : "default"}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
