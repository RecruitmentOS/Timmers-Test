"use client";

import { usePresence, type Viewer } from "@/hooks/use-presence";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Stable color from a string hash — 8 muted palette options. */
const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const MAX_VISIBLE = 5;

function ViewerAvatar({ viewer }: { viewer: Viewer }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Avatar size="sm" className="animate-in fade-in duration-150">
            <AvatarFallback
              className={`${colorFromName(viewer.userName)} text-white text-[10px] font-medium`}
            >
              {initials(viewer.userName)}
            </AvatarFallback>
          </Avatar>
        }
      />
      <TooltipContent side="bottom">
        <p className="text-xs">{viewer.userName}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Linear/Figma-style avatar stack showing who else is viewing a pipeline.
 *
 * Shows max 5 avatars with a "+N" overflow badge.
 * Each avatar has initials colored by a deterministic hash of the name.
 */
export function PresenceAvatars({ vacancyId }: { vacancyId: string }) {
  const { viewers } = usePresence(vacancyId);

  if (viewers.length === 0) return null;

  const visible = viewers.slice(0, MAX_VISIBLE);
  const overflow = viewers.length - MAX_VISIBLE;

  return (
    <AvatarGroup>
      {visible.map((v) => (
        <ViewerAvatar key={v.userId} viewer={v} />
      ))}
      {overflow > 0 && (
        <AvatarGroupCount className="text-xs">
          +{overflow}
        </AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}
