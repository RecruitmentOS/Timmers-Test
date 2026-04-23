import { cn } from "@/lib/utils";

interface MatchScoreBadgeProps {
  score: number | null | undefined;
  size?: "sm" | "md";
}

export function MatchScoreBadge({ score, size = "md" }: MatchScoreBadgeProps) {
  if (score === null || score === undefined) return null;

  const color =
    score >= 75
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : score >= 50
        ? "bg-amber-100 text-amber-700 ring-amber-200"
        : "bg-rose-100 text-rose-700 ring-rose-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold ring-1 ring-inset tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        color
      )}
      title={`Match score: ${score}%`}
    >
      {score}%
    </span>
  );
}
