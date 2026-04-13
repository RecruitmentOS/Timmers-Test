"use client";

import { useAIUsage } from "@/hooks/use-ai-screening";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * AI Usage dashboard section for admin settings.
 * Shows monthly screening count, tokens, and quota progress bar.
 */
export function AIUsageSection() {
  const { data: usage, isLoading } = useAIUsage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const screeningCount = usage?.screeningCount ?? 0;
  const quotaLimit = usage?.quotaLimit ?? 500;
  const screeningTokens = usage?.screeningTokens ?? 0;
  const parseCount = usage?.parseCount ?? 0;
  const parseTokens = usage?.parseTokens ?? 0;
  const percent = quotaLimit > 0 ? (screeningCount / quotaLimit) * 100 : 0;

  const barColor =
    percent > 95
      ? "bg-rose-500"
      : percent > 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI Gebruik deze maand</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quota progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Screenings</span>
            <span className="font-medium">
              {screeningCount} / {quotaLimit}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
            <div
              className={`h-2 rounded-full transition-all ${barColor}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Screening tokens</span>
            <p className="font-medium">{screeningTokens.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-500">CV parses</span>
            <p className="font-medium">{parseCount}</p>
          </div>
          <div>
            <span className="text-slate-500">Parse tokens</span>
            <p className="font-medium">{parseTokens.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-slate-500">Totaal tokens</span>
            <p className="font-medium">
              {(screeningTokens + parseTokens).toLocaleString()}
            </p>
          </div>
        </div>

        {percent > 80 && (
          <p className="text-xs text-amber-600">
            {percent > 95
              ? "Quota bijna bereikt. Neem contact op om de limiet te verhogen."
              : "Meer dan 80% van het maandelijks quotum gebruikt."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
