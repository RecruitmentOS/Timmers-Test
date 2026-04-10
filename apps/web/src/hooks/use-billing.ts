"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { UsageSummary, BillingDashboard } from "@recruitment-os/types";

// ==========================================
// Billing usage (lightweight)
// ==========================================

export function useBillingUsage() {
  return useQuery<UsageSummary>({
    queryKey: ["billing", "usage"],
    queryFn: () => apiClient("/api/billing/usage"),
    staleTime: 60_000,
  });
}

// ==========================================
// Billing dashboard (full: usage + trial + status)
// ==========================================

export function useBillingDashboard() {
  return useQuery<BillingDashboard>({
    queryKey: ["billing", "dashboard"],
    queryFn: () => apiClient("/api/billing/dashboard"),
    staleTime: 60_000,
  });
}

// ==========================================
// Stripe Customer Portal session
// ==========================================

export function usePortalSession() {
  return useMutation<{ url: string | null }>({
    mutationFn: () =>
      apiClient<{ url: string | null }>("/api/billing/portal-session", {
        method: "POST",
        body: JSON.stringify({
          returnUrl: typeof window !== "undefined" ? window.location.href : "/",
        }),
      }),
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
  });
}
