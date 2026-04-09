"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STAGE_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
];

type Props = {
  stages: { name: string; count: number }[];
};

export function StageCounts({ stages }: Props) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {stages.map((stage, i) => {
          const pct = (stage.count / total) * 100;
          return (
            <Tooltip key={stage.name}>
              <TooltipTrigger asChild>
                <div
                  className={`${STAGE_COLORS[i % STAGE_COLORS.length]} rounded-sm transition-all`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {stage.name}: {stage.count}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
