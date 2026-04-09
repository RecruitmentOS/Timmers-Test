"use client";

import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Period = "7d" | "30d" | "90d" | "custom";

const PERIOD_OPTIONS: { value: Period; labelNl: string; labelEn: string }[] = [
  { value: "7d", labelNl: "Laatste 7 dagen", labelEn: "Last 7 days" },
  { value: "30d", labelNl: "Laatste 30 dagen", labelEn: "Last 30 days" },
  { value: "90d", labelNl: "Laatste 90 dagen", labelEn: "Last 90 days" },
  { value: "custom", labelNl: "Aangepaste periode", labelEn: "Custom period" },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * TimePeriodPicker — global time-period selector for the reports page.
 * Uses nuqs for URL state so filtered views are shareable.
 * Returns startDate + endDate as ISO date strings.
 */
export function TimePeriodPicker() {
  const [period, setPeriod] = useQueryState("period", { defaultValue: "30d" });
  const [startDate, setStartDate] = useQueryState("startDate", {
    defaultValue: daysAgo(30),
  });
  const [endDate, setEndDate] = useQueryState("endDate", {
    defaultValue: today(),
  });

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    if (p === "7d") {
      setStartDate(daysAgo(7));
      setEndDate(today());
    } else if (p === "30d") {
      setStartDate(daysAgo(30));
      setEndDate(today());
    } else if (p === "90d") {
      setStartDate(daysAgo(90));
      setEndDate(today());
    }
    // custom: keep current startDate/endDate
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIOD_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={period === opt.value ? "default" : "outline"}
          size="sm"
          onClick={() => handlePeriodChange(opt.value)}
        >
          {opt.labelNl}
        </Button>
      ))}
      {period === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate ?? ""}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36"
          />
          <span className="text-muted-foreground">t/m</span>
          <Input
            type="date"
            value={endDate ?? ""}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Hook to read the current period params from URL state.
 * Used by the reports page to pass to useReport hooks.
 */
export function useTimePeriodParams(): { startDate: string; endDate: string } {
  const [startDate] = useQueryState("startDate", {
    defaultValue: daysAgo(30),
  });
  const [endDate] = useQueryState("endDate", {
    defaultValue: today(),
  });

  return useMemo(
    () => ({
      startDate: startDate ?? daysAgo(30),
      endDate: endDate ?? today(),
    }),
    [startDate, endDate]
  );
}
