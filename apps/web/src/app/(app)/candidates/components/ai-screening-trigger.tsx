"use client";

import { useState } from "react";
import {
  useTriggerScreening,
  useScreeningHistory,
} from "@/hooks/use-ai-screening";
import { AIScreeningBadge } from "./ai-screening-badge";
import { Button } from "@/components/ui/button";
import type { AIScreeningResult, AIScreeningVerdict } from "@recruitment-os/types";

type Props = {
  applicationId: string;
};

/**
 * AI screening trigger button + result display.
 * Shows most recent screening result or allows triggering a new one.
 */
export function AIScreeningTrigger({ applicationId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const triggerMutation = useTriggerScreening();
  const { data: history } = useScreeningHistory(applicationId);

  const latestLog = history?.[0];
  const latestResult: AIScreeningResult | null =
    latestLog?.status === "success" && latestLog.verdict
      ? {
          verdict: latestLog.verdict as AIScreeningVerdict,
          reasoning: latestLog.reasoning ?? "",
          confidence: parseFloat(latestLog.confidence ?? "0"),
          matchedCriteria: (latestLog.matchedCriteria as string[]) ?? [],
          missingCriteria: (latestLog.missingCriteria as string[]) ?? [],
        }
      : null;

  const handleTrigger = async (force = false) => {
    try {
      await triggerMutation.mutateAsync({ applicationId, force });
    } catch {
      // Error handled via mutation state
    }
  };

  const isLoading = triggerMutation.isPending;
  const error = triggerMutation.error;
  const mutationResult = triggerMutation.data;

  // Use mutation result if available, otherwise latest from history
  const displayResult = mutationResult?.result ?? latestResult;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleTrigger(false)}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg
                className="mr-1 h-3 w-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Bezig met screenen...
            </>
          ) : (
            <>
              <svg
                className="mr-1 h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />
              </svg>
              AI Screening
            </>
          )}
        </Button>

        {displayResult && (
          <AIScreeningBadge
            verdict={displayResult.verdict}
            confidence={displayResult.confidence}
          />
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-600">
          {error.message.includes("QUOTA_EXCEEDED") || error.message.includes("limiet")
            ? "AI-limiet bereikt voor deze maand"
            : `Fout: ${error.message}`}
        </p>
      )}

      {displayResult && (
        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between text-xs text-slate-600"
            onClick={() => setExpanded(!expanded)}
          >
            <span>AI Beoordeling</span>
            <span>{expanded ? "Inklappen" : "Meer details"}</span>
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 text-xs">
              <p className="text-slate-700">{displayResult.reasoning}</p>

              {displayResult.matchedCriteria.length > 0 && (
                <div>
                  <span className="font-medium text-emerald-700">
                    Voldoet aan:
                  </span>
                  <ul className="ml-3 list-disc text-slate-600">
                    {displayResult.matchedCriteria.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {displayResult.missingCriteria.length > 0 && (
                <div>
                  <span className="font-medium text-rose-700">Ontbreekt:</span>
                  <ul className="ml-3 list-disc text-slate-600">
                    {displayResult.missingCriteria.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => handleTrigger(true)}
                disabled={isLoading}
              >
                Opnieuw screenen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
