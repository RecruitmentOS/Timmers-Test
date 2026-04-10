"use client";

import { MapPin } from "lucide-react";
import { useRadiusSearch } from "@/hooks/use-geocoding";
import type { CandidateWithDistance } from "@recruitment-os/types";
import { useEffect, useState } from "react";

// --- DistanceBadge ---

interface DistanceBadgeProps {
  distanceKm: number | null | undefined;
  size?: "sm" | "md";
}

function getDistanceColor(km: number): string {
  if (km <= 15) return "bg-green-100 text-green-800";
  if (km <= 30) return "bg-yellow-100 text-yellow-800";
  if (km <= 50) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

/**
 * Color-coded distance badge for pipeline cards and detail views.
 * Green <= 15km, Yellow 15-30km, Orange 30-50km, Red > 50km.
 */
export function DistanceBadge({ distanceKm, size = "sm" }: DistanceBadgeProps) {
  if (distanceKm == null) return null;

  const rounded = Math.round(distanceKm * 10) / 10;
  const colorClass = getDistanceColor(rounded);
  const iconSize = size === "sm" ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      <MapPin size={iconSize} />
      {rounded} km
    </span>
  );
}

// --- RadiusFilter ---

const RADIUS_OPTIONS = [5, 10, 15, 25, 50, 100] as const;

interface RadiusFilterProps {
  vacancyId: string;
  onResults: (candidates: CandidateWithDistance[]) => void;
}

/**
 * Radius filter dropdown for searching candidates near a vacancy.
 * Displays result count: "N kandidaten binnen X km".
 */
export function RadiusFilter({ vacancyId, onResults }: RadiusFilterProps) {
  const [selectedRadius, setSelectedRadius] = useState(25);
  const { data: results, isLoading } = useRadiusSearch(
    vacancyId,
    selectedRadius
  );

  useEffect(() => {
    if (results) {
      onResults(results);
    }
  }, [results, onResults]);

  return (
    <div className="flex items-center gap-2">
      <MapPin size={16} className="text-muted-foreground" />
      <select
        value={selectedRadius}
        onChange={(e) => setSelectedRadius(Number(e.target.value))}
        className="rounded border border-input bg-background px-2 py-1 text-sm"
      >
        {RADIUS_OPTIONS.map((km) => (
          <option key={km} value={km}>
            {km} km
          </option>
        ))}
      </select>
      <span className="text-sm text-muted-foreground">
        {isLoading
          ? "Zoeken..."
          : results
            ? `${results.length} kandidaten binnen ${selectedRadius} km`
            : ""}
      </span>
    </div>
  );
}
