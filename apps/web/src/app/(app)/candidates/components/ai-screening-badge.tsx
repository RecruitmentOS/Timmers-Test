"use client";

import type { AIScreeningVerdict } from "@recruitment-os/types";

type Props = {
  verdict: AIScreeningVerdict | null;
  confidence?: number;
};

const BADGE_STYLES: Record<string, string> = {
  yes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  maybe: "bg-amber-100 text-amber-800 border-amber-200",
  no: "bg-rose-100 text-rose-800 border-rose-200",
  null: "bg-slate-100 text-slate-500 border-slate-200",
};

const BADGE_LABELS: Record<string, string> = {
  yes: "AI: Ja",
  maybe: "AI: Misschien",
  no: "AI: Nee",
};

/**
 * Non-binding AI screening verdict badge.
 * Display-only: does NOT modify qualificationStatus (AI-03).
 */
export function AIScreeningBadge({ verdict, confidence }: Props) {
  if (!verdict) return null;

  const style = BADGE_STYLES[verdict] ?? BADGE_STYLES.null;
  const label = BADGE_LABELS[verdict] ?? "AI: —";
  const confidenceText =
    confidence != null ? `${Math.round(confidence * 100)}% zekerheid` : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
      title={confidenceText}
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
      {label}
    </span>
  );
}
