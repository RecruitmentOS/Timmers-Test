"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineFilters } from "@/components/pipeline/pipeline-filters";
import type { PipelineFilters as Filters } from "@/hooks/use-pipeline";

export default function PipelinePage() {
  const params = useParams<{ id: string }>();
  const [filters, setFilters] = useState<Filters>({});

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <h1 className="text-lg font-semibold">Pipeline board</h1>
        <Link
          href={`/vacancies/${params.id}`}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          ← Terug naar vacature
        </Link>
      </div>
      <PipelineFilters onChange={setFilters} />
      <div className="flex-1 overflow-hidden">
        <PipelineBoard vacancyId={params.id} filters={filters} />
      </div>
    </div>
  );
}
