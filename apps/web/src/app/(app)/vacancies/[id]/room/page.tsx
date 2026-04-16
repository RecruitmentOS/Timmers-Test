// apps/web/src/app/(app)/vacancies/[id]/room/page.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useVacancy } from "@/hooks/use-vacancies";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineFilters } from "@/components/pipeline/pipeline-filters";
import { RoomHeader } from "@/components/room/room-header";
import { RoomTimeline } from "@/components/room/room-timeline";
import { RoomMessageInput } from "@/components/room/room-message-input";
import { useRoomTimelineSync } from "@/hooks/use-socket";
import { Skeleton } from "@/components/ui/skeleton";
import type { PipelineFilters as Filters } from "@/hooks/use-pipeline";

export default function VacancyRoomPage() {
  const params = useParams<{ id: string }>();
  const vacancyId = params.id;
  const { data: vacancy, isLoading } = useVacancy(vacancyId);
  const [filters, setFilters] = useState<Filters>({});

  // Real-time sync for timeline
  useRoomTimelineSync(vacancyId);

  if (isLoading || !vacancy) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-2 h-5 w-96" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Room header with stats */}
      <RoomHeader vacancy={vacancy} vacancyId={vacancyId} />

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Pipeline */}
        <div className="flex w-3/5 flex-col border-r border-slate-200">
          <PipelineFilters onChange={setFilters} />
          <div className="flex-1 overflow-hidden">
            <PipelineBoard vacancyId={vacancyId} filters={filters} />
          </div>
        </div>

        {/* Right panel: Timeline */}
        <div className="flex w-2/5 flex-col bg-slate-50">
          <RoomTimeline vacancyId={vacancyId} />
          <RoomMessageInput vacancyId={vacancyId} />
        </div>
      </div>
    </div>
  );
}
