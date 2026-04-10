"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CandidateWithDistance, GeoCoordinates } from "@recruitment-os/types";

/**
 * Search candidates within a radius (km) of a vacancy location.
 * Returns candidates sorted by distance with Haversine calculation.
 */
export function useRadiusSearch(vacancyId: string, radiusKm: number = 25) {
  return useQuery<CandidateWithDistance[]>({
    queryKey: ["geo-radius", vacancyId, radiusKm],
    queryFn: () =>
      apiClient<CandidateWithDistance[]>(
        `/api/geo/radius/${vacancyId}?km=${radiusKm}`
      ),
    enabled: !!vacancyId,
  });
}

/**
 * Get distance between a specific candidate and vacancy.
 * Returns { distanceKm: number } or { distanceKm: null } if not geocoded.
 */
export function useCandidateDistance(
  candidateId: string,
  vacancyId: string
) {
  return useQuery<{ distanceKm: number | null }>({
    queryKey: ["geo-distance", candidateId, vacancyId],
    queryFn: () =>
      apiClient<{ distanceKm: number | null }>(
        `/api/geo/distance/${candidateId}/${vacancyId}`
      ),
    enabled: !!candidateId && !!vacancyId,
  });
}

/**
 * Mutation to manually trigger geocoding for a candidate or vacancy.
 */
export function useTriggerGeocode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      id,
    }: {
      type: "candidate" | "vacancy";
      id: string;
    }) =>
      apiClient<GeoCoordinates>(`/api/geo/geocode/${type}/${id}`, {
        method: "POST",
      }),
    onSuccess: () => {
      // Invalidate all geo queries since coordinates changed
      qc.invalidateQueries({ queryKey: ["geo-radius"] });
      qc.invalidateQueries({ queryKey: ["geo-distance"] });
    },
  });
}
