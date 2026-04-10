"use client";

import { AlertTriangle } from "lucide-react";
import type { LicenseBadge as LicenseBadgeType } from "@recruitment-os/types";

/**
 * Maps qualification type to display label.
 */
function typeLabel(type: string): string {
  switch (type) {
    case "code95":
      return "95";
    case "adr":
      return "ADR";
    case "digitachograaf":
      return "DIGI";
    default:
      return type.toUpperCase();
  }
}

/**
 * Determines the expiry status for color coding.
 */
function getExpiryStatus(
  badge: LicenseBadgeType
): "valid" | "expiring" | "expired" {
  if (badge.expired) return "expired";
  if (!badge.expiresAt) return "valid";

  const now = new Date();
  const expiry = new Date(badge.expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) return "expiring";
  return "valid";
}

const colorMap = {
  valid: "bg-green-100 text-green-800",
  expiring: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-800",
} as const;

interface LicenseBadgeProps {
  badge: LicenseBadgeType;
  size?: "sm" | "md";
}

/**
 * Single license badge with expiry-aware coloring.
 */
export function LicenseBadge({ badge, size = "sm" }: LicenseBadgeProps) {
  const status = getExpiryStatus(badge);
  const colors = colorMap[status];
  const sizeClasses =
    size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${colors} ${sizeClasses}`}
      title={
        badge.expiresAt
          ? `${typeLabel(badge.type)} - ${status === "expired" ? "Verlopen" : `Verloopt: ${badge.expiresAt}`}`
          : typeLabel(badge.type)
      }
    >
      {status === "expired" && <AlertTriangle className="h-3 w-3" />}
      {typeLabel(badge.type)}
    </span>
  );
}

interface LicenseBadgesProps {
  badges: LicenseBadgeType[];
  size?: "sm" | "md";
}

/**
 * Row of license badges for pipeline cards and candidate detail views.
 */
export function LicenseBadges({ badges, size = "sm" }: LicenseBadgesProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {badges.map((badge, i) => (
        <LicenseBadge key={`${badge.type}-${i}`} badge={badge} size={size} />
      ))}
    </div>
  );
}

interface MismatchWarningProps {
  missing: string[];
}

/**
 * Warning displayed on pipeline cards when a candidate is missing
 * licenses required by the vacancy.
 */
export function MismatchWarning({ missing }: MismatchWarningProps) {
  if (!missing || missing.length === 0) return null;

  return (
    <span className="text-xs text-red-600 font-medium">
      Ontbreekt: {missing.join(", ")}
    </span>
  );
}
