"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ReportName } from "@recruitment-os/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Generic report hook — one useQuery per report widget.
 * Keys: ["reports", name, params] so each widget has its own cache.
 */
export function useReport<T>(
  name: ReportName,
  params: { startDate: string; endDate: string; vacancyId?: string }
) {
  const searchParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  if (params.vacancyId) searchParams.set("vacancyId", params.vacancyId);

  return useQuery<T>({
    queryKey: ["reports", name, params],
    queryFn: () =>
      apiClient<T>(`/api/reports/${name}?${searchParams.toString()}`),
    staleTime: 60_000, // Reports are analytical — 60s stale is fine
  });
}

/**
 * CSV download helper — fetches the CSV blob and triggers browser download.
 */
export function useDownloadCSV() {
  return async (
    name: ReportName,
    params: { startDate: string; endDate: string; vacancyId?: string }
  ) => {
    const searchParams = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.vacancyId) searchParams.set("vacancyId", params.vacancyId);

    const res = await fetch(
      `${API_BASE}/api/reports/${name}.csv?${searchParams.toString()}`,
      { credentials: "include" }
    );
    if (!res.ok) throw new Error(`CSV download failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
}
