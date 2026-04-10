"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type { OnboardingInput, OnboardingResult } from "@recruitment-os/types";

/**
 * Mutation hook for creating an organization during onboarding.
 * On success, redirects to /dashboard.
 */
export function useCreateOrganization() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: OnboardingInput) =>
      apiClient<OnboardingResult>("/api/onboarding/create-org", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      router.push("/dashboard");
    },
  });
}

/**
 * Query hook for checking slug availability with debounce.
 * Only enabled when slug length > 2.
 */
export function useCheckSlug(slug: string) {
  return useQuery({
    queryKey: ["check-slug", slug],
    queryFn: () =>
      apiClient<{ available: boolean }>(
        `/api/onboarding/check-slug/${encodeURIComponent(slug)}`
      ),
    enabled: slug.length > 2,
    staleTime: 5000,
  });
}
