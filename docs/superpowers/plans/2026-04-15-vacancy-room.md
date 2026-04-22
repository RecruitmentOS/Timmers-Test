# Vacancy Room + Room Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Vacancy Room — a two-panel shared workspace per vacancy where pipeline, timeline, feedback, and metrics live side by side. This is Step 1 of the Collaboration-First Redesign and the primary demo weapon for design partners.

**Architecture:** New route `/vacancies/[id]/room` with a split layout: left panel embeds the existing `PipelineBoard` component, right panel renders a unified Room Timeline that merges comments + activity events into one chronological stream. A new backend service unions `comments` and `activity_log` tables into a single paginated feed with role-based filtering. No new database tables — read-side aggregation over existing write paths.

**Tech Stack:** Next.js App Router, Hono API, TanStack Query (infinite scroll), Socket.IO (real-time timeline), existing shadcn/ui components, existing @dnd-kit pipeline.

**Spec:** `docs/superpowers/specs/2026-04-14-collaboration-first-redesign.md`

---

## File Map

### Backend (apps/api/src)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `services/room-timeline.service.ts` | Merge comments + activity_log into unified feed |
| Create | `routes/room-timeline.routes.ts` | `GET /api/room-timeline` endpoint |
| Modify | `index.ts` | Mount room-timeline routes |
| Modify | `lib/socket.ts` | Emit `room:timeline` event on new comments for vacancy targets |

### Frontend (apps/web/src)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `hooks/use-room-timeline.ts` | Infinite query hook for room timeline |
| Create | `hooks/use-room-stats.ts` | Query hook for room header stats |
| Create | `components/room/room-timeline.tsx` | Renders unified timeline feed |
| Create | `components/room/room-timeline-item.tsx` | Single timeline item (comment or event) |
| Create | `components/room/room-header.tsx` | Vacancy info + stats bar + presence |
| Create | `components/room/room-message-input.tsx` | Comment input adapted for room context |
| Create | `app/(app)/vacancies/[id]/room/page.tsx` | Two-panel Room page |
| Modify | `hooks/use-socket.ts` | Add `useRoomTimelineSync` hook |

### Shared (packages/types/src)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `room-timeline.ts` | `RoomTimelineItem` type (union of comment + event) |
| Modify | `index.ts` | Re-export room-timeline types |

---

## Task 1: Room Timeline shared types

**Files:**
- Create: `packages/types/src/room-timeline.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Create the RoomTimelineItem type**

```typescript
// packages/types/src/room-timeline.ts

/**
 * Unified timeline item for Vacancy Rooms.
 * Merges comments and activity events into one stream.
 */
export type RoomTimelineItemKind = "comment" | "event";

export interface RoomTimelineComment {
  kind: "comment";
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string;
  mentions: string[];
  commentKind: "comment" | "hm_feedback";
  feedbackThumb: "up" | "down" | null;
  isInternal: boolean;
  createdAt: string;
}

export interface RoomTimelineEvent {
  kind: "event";
  id: string;
  eventType: string;
  actorId: string;
  actorName: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export type RoomTimelineItem = RoomTimelineComment | RoomTimelineEvent;

export interface RoomTimelinePage {
  items: RoomTimelineItem[];
  nextCursor: string | null;
}

export interface RoomStats {
  total: number;
  qualified: number;
  interview: number;
  overdue: number;
}
```

- [ ] **Step 2: Export from types index**

Add to `packages/types/src/index.ts`:

```typescript
export * from "./room-timeline.js";
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter @recruitment-os/types build`
Expected: Clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/room-timeline.ts packages/types/src/index.ts
git commit -m "feat(types): add RoomTimelineItem types for vacancy room"
```

---

## Task 2: Room Timeline backend service

**Files:**
- Create: `apps/api/src/services/room-timeline.service.ts`

- [ ] **Step 1: Create the room timeline service**

This service queries both `comments` and `activity_log` for a vacancy, unions them into a single chronological stream, and paginates with cursor-based pagination. The `includeInternal` flag controls whether internal comments are included (false for client/HM roles).

```typescript
// apps/api/src/services/room-timeline.service.ts
import { eq, and, or, lt, sql, desc } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { comments, activityLog } from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import type {
  RoomTimelineItem,
  RoomTimelineComment,
  RoomTimelineEvent,
  RoomTimelinePage,
} from "@recruitment-os/types";

export const roomTimelineService = {
  async getTimeline(
    orgId: string,
    vacancyId: string,
    options: {
      limit?: number;
      cursor?: string;
      includeInternal?: boolean;
    } = {}
  ): Promise<RoomTimelinePage> {
    const limit = options.limit ?? 30;
    const includeInternal = options.includeInternal ?? true;

    return withTenantContext(orgId, async (tx) => {
      // --- Query 1: Comments on this vacancy ---
      const commentConditions = [
        eq(comments.targetType, "vacancy"),
        eq(comments.targetId, vacancyId),
      ];
      if (!includeInternal) {
        commentConditions.push(eq(comments.isInternal, false));
      }
      if (options.cursor) {
        commentConditions.push(lt(comments.createdAt, new Date(options.cursor)));
      }

      const commentRows = await tx
        .select({
          id: comments.id,
          authorId: comments.authorId,
          authorName: user.name,
          authorAvatar: user.image,
          body: comments.body,
          mentions: comments.mentions,
          commentKind: comments.kind,
          feedbackThumb: comments.feedbackThumb,
          isInternal: comments.isInternal,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .leftJoin(user, eq(comments.authorId, user.id))
        .where(and(...commentConditions))
        .orderBy(desc(comments.createdAt))
        .limit(limit + 1);

      // --- Query 2: Activity events for this vacancy ---
      const eventConditions = [
        or(
          and(
            eq(activityLog.entityType, "vacancy"),
            eq(activityLog.entityId, vacancyId)
          ),
          and(
            eq(activityLog.entityType, "application"),
            sql`${activityLog.metadata}->>'vacancyId' = ${vacancyId}`
          ),
          and(
            eq(activityLog.entityType, "task"),
            sql`${activityLog.metadata}->>'vacancyId' = ${vacancyId}`
          )
        ),
      ];
      if (options.cursor) {
        eventConditions.push(lt(activityLog.createdAt, new Date(options.cursor)));
      }

      const eventRows = await tx
        .select({
          id: activityLog.id,
          eventType: activityLog.action,
          actorId: activityLog.actorId,
          actorName: user.name,
          meta: activityLog.metadata,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .leftJoin(user, eq(activityLog.actorId, user.id))
        .where(and(...eventConditions))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit + 1);

      // --- Merge, sort, paginate ---
      const commentItems: RoomTimelineItem[] = commentRows.map((r) => ({
        kind: "comment" as const,
        id: r.id,
        authorId: r.authorId,
        authorName: r.authorName ?? "Unknown",
        authorAvatar: r.authorAvatar ?? undefined,
        body: r.body,
        mentions: (r.mentions as string[]) ?? [],
        commentKind: r.commentKind as RoomTimelineComment["commentKind"],
        feedbackThumb: r.feedbackThumb as RoomTimelineComment["feedbackThumb"],
        isInternal: r.isInternal,
        createdAt: r.createdAt.toISOString(),
      }));

      const eventItems: RoomTimelineItem[] = eventRows
        .filter((r) => r.eventType !== "comment_added") // avoid duplicating comments
        .map((r) => ({
          kind: "event" as const,
          id: r.id,
          eventType: r.eventType,
          actorId: r.actorId,
          actorName: r.actorName ?? "Unknown",
          meta: (r.meta as Record<string, unknown>) ?? {},
          createdAt: r.createdAt.toISOString(),
        }));

      // Merge and sort descending by createdAt
      const merged = [...commentItems, ...eventItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Take limit items + determine nextCursor
      const hasMore = merged.length > limit;
      const items = merged.slice(0, limit);
      const nextCursor = hasMore
        ? items[items.length - 1].createdAt
        : null;

      return { items, nextCursor };
    });
  },
};
```

- [ ] **Step 2: Verify the service file compiles**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter api build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/room-timeline.service.ts
git commit -m "feat(api): add room timeline service (unions comments + activity)"
```

---

## Task 3: Room Timeline API route

**Files:**
- Create: `apps/api/src/routes/room-timeline.routes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// apps/api/src/routes/room-timeline.routes.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { roomTimelineService } from "../services/room-timeline.service.js";
import { errorResponse } from "../lib/errors.js";

const timelineQuerySchema = z.object({
  vacancyId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  includeInternal: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export const roomTimelineRoutes = new Hono<AppEnv>().get(
  "/",
  requirePermission("activity", "read"),
  zValidator("query", timelineQuerySchema),
  async (c) => {
    try {
      const orgId = c.get("organizationId");
      const q = c.req.valid("query");
      const result = await roomTimelineService.getTimeline(orgId, q.vacancyId, {
        limit: q.limit,
        cursor: q.cursor,
        includeInternal: q.includeInternal,
      });
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  }
);
```

- [ ] **Step 2: Mount the route in index.ts**

Add import and route mount in `apps/api/src/index.ts`:

After the existing import for `activityRoutes`, add:
```typescript
import { roomTimelineRoutes } from "./routes/room-timeline.routes.js";
```

After the line `app.route("/api/activity", activityRoutes);`, add:
```typescript
app.route("/api/room-timeline", roomTimelineRoutes);
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter api build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/room-timeline.routes.ts apps/api/src/index.ts
git commit -m "feat(api): add GET /api/room-timeline endpoint"
```

---

## Task 4: Room stats endpoint

**Files:**
- Modify: `apps/api/src/routes/room-timeline.routes.ts`

The Room header needs stats: total candidates, qualified, in interview stage, overdue. We'll add a `/stats` sub-route to the room-timeline routes.

- [ ] **Step 1: Add stats query to room-timeline routes**

Append this route to the existing chain in `room-timeline.routes.ts`, after the `.get("/", ...)`:

```typescript
// Add these imports at the top of the file:
import { candidateApplications, pipelineStages, tasks } from "../db/schema/index.js";
import { eq, and, count, isNull, lt } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";

// Add this route after the existing .get("/", ...) — chain it
.get(
  "/stats",
  requirePermission("vacancy", "read"),
  zValidator("query", z.object({ vacancyId: z.string().uuid() })),
  async (c) => {
    try {
      const orgId = c.get("organizationId");
      const { vacancyId } = c.req.valid("query");

      const stats = await withTenantContext(orgId, async (tx) => {
        // Total applications for this vacancy
        const [totalRow] = await tx
          .select({ count: count() })
          .from(candidateApplications)
          .where(eq(candidateApplications.vacancyId, vacancyId));

        // Qualified (qualificationStatus = 'yes')
        const [qualifiedRow] = await tx
          .select({ count: count() })
          .from(candidateApplications)
          .where(
            and(
              eq(candidateApplications.vacancyId, vacancyId),
              eq(candidateApplications.qualificationStatus, "yes")
            )
          );

        // Interview stage count
        const [interviewRow] = await tx
          .select({ count: count() })
          .from(candidateApplications)
          .innerJoin(
            pipelineStages,
            eq(candidateApplications.currentStageId, pipelineStages.id)
          )
          .where(
            and(
              eq(candidateApplications.vacancyId, vacancyId),
              eq(pipelineStages.slug, "interview")
            )
          );

        // Overdue: applications with at least one overdue open task
        const [overdueRow] = await tx
          .select({ count: count() })
          .from(tasks)
          .where(
            and(
              eq(tasks.vacancyId, vacancyId),
              eq(tasks.status, "open"),
              lt(tasks.dueDate, new Date()),
              isNull(tasks.completedAt)
            )
          );

        return {
          total: totalRow.count,
          qualified: qualifiedRow.count,
          interview: interviewRow.count,
          overdue: overdueRow.count,
        };
      });

      return c.json(stats);
    } catch (e) {
      return errorResponse(c, e as Error);
    }
  }
)
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter api build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/room-timeline.routes.ts
git commit -m "feat(api): add GET /api/room-timeline/stats for room header"
```

---

## Task 5: Frontend — Room Timeline hook

**Files:**
- Create: `apps/web/src/hooks/use-room-timeline.ts`

- [ ] **Step 1: Create the infinite query hook**

```typescript
// apps/web/src/hooks/use-room-timeline.ts
"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RoomTimelinePage } from "@recruitment-os/types";

export function useRoomTimeline(
  vacancyId: string,
  includeInternal = true
) {
  return useInfiniteQuery<RoomTimelinePage>({
    queryKey: ["room-timeline", vacancyId, includeInternal],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        vacancyId,
        includeInternal: String(includeInternal),
      });
      if (pageParam) params.set("cursor", pageParam as string);
      return apiClient<RoomTimelinePage>(
        `/api/room-timeline?${params.toString()}`
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!vacancyId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-room-timeline.ts
git commit -m "feat(web): add useRoomTimeline infinite query hook"
```

---

## Task 6: Frontend — Room Stats hook

**Files:**
- Create: `apps/web/src/hooks/use-room-stats.ts`

- [ ] **Step 1: Create the stats query hook**

```typescript
// apps/web/src/hooks/use-room-stats.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { RoomStats } from "@recruitment-os/types";

export function useRoomStats(vacancyId: string) {
  return useQuery<RoomStats>({
    queryKey: ["room-stats", vacancyId],
    queryFn: () =>
      apiClient<RoomStats>(
        `/api/room-timeline/stats?vacancyId=${vacancyId}`
      ),
    enabled: !!vacancyId,
    refetchInterval: 30_000, // refresh stats every 30s
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-room-stats.ts
git commit -m "feat(web): add useRoomStats query hook"
```

---

## Task 7: Frontend — Room Timeline Item component

**Files:**
- Create: `apps/web/src/components/room/room-timeline-item.tsx`

- [ ] **Step 1: Create the timeline item component**

This renders a single item in the timeline — either a comment (with avatar, body, mentions, internal badge, feedback thumb) or a system event (compact, icon-based).

```typescript
// apps/web/src/components/room/room-timeline-item.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MentionChip } from "@/components/collaboration/mention-chip";
import {
  Lock,
  ArrowRight,
  CheckCircle2,
  UserPlus,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";
import type {
  RoomTimelineItem as TimelineItem,
  RoomTimelineComment,
  RoomTimelineEvent,
} from "@recruitment-os/types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CommentItem({ item }: { item: RoomTimelineComment }) {
  return (
    <div className="flex gap-3">
      <Avatar>
        {item.authorAvatar && (
          <AvatarImage src={item.authorAvatar} alt={item.authorName} />
        )}
        <AvatarFallback>{initials(item.authorName)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{item.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
              locale: getDateLocale(),
            })}
          </span>
          {item.isInternal && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Lock className="size-3" />
              Intern
            </Badge>
          )}
          {item.commentKind === "hm_feedback" && item.feedbackThumb && (
            <Badge
              variant={item.feedbackThumb === "up" ? "default" : "destructive"}
              className="gap-1 text-xs"
            >
              {item.feedbackThumb === "up" ? (
                <ThumbsUp className="size-3" />
              ) : (
                <ThumbsDown className="size-3" />
              )}
              Feedback
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{item.body}</p>
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stage_changed: ArrowRight,
  qualified: CheckCircle2,
  assigned: UserPlus,
};

const EVENT_LABELS: Record<string, (meta: Record<string, unknown>) => string> = {
  stage_changed: (meta) =>
    `verplaatst naar ${(meta.toStageName as string) ?? "volgende fase"}`,
  qualified: (meta) =>
    `gemarkeerd als ${(meta.status as string) ?? "beoordeeld"}`,
  assigned: () => "toegewezen",
  task_created: () => "taak aangemaakt",
  task_completed: () => "taak afgerond",
  sent_to_client: () => "voorgesteld aan klant",
  sent_to_hiring_manager: () => "doorgestuurd naar hiring manager",
  hm_feedback: (meta) =>
    `feedback: ${(meta.feedbackThumb as string) === "up" ? "positief" : "negatief"}`,
  hm_request: () => "verzoek om meer kandidaten",
  created: () => "aangemaakt",
};

function EventItem({ item }: { item: RoomTimelineEvent }) {
  const Icon = EVENT_ICONS[item.eventType] ?? ArrowRight;
  const labelFn = EVENT_LABELS[item.eventType];
  const label = labelFn ? labelFn(item.meta) : item.eventType;
  const candidateName =
    ((item.meta.candidateFirstName as string) ?? "") +
    " " +
    ((item.meta.candidateLastName as string) ?? "");
  const showCandidate = candidateName.trim().length > 0;

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span>
        <span className="font-medium text-foreground">{item.actorName}</span>
        {" "}
        {label}
        {showCandidate && (
          <>
            {" — "}
            <span className="font-medium text-foreground">
              {candidateName.trim()}
            </span>
          </>
        )}
      </span>
      <span className="ml-auto shrink-0">
        {formatDistanceToNow(new Date(item.createdAt), {
          addSuffix: true,
          locale: getDateLocale(),
        })}
      </span>
    </div>
  );
}

export function RoomTimelineItem({ item }: { item: TimelineItem }) {
  if (item.kind === "comment") {
    return <CommentItem item={item} />;
  }
  return <EventItem item={item} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/room/room-timeline-item.tsx
git commit -m "feat(web): add RoomTimelineItem component (comment + event rendering)"
```

---

## Task 8: Frontend — Room Timeline component

**Files:**
- Create: `apps/web/src/components/room/room-timeline.tsx`

- [ ] **Step 1: Create the timeline feed component**

Infinite-scroll timeline that loads older items when scrolling up. New items appear at the bottom (chronological order, reversed from API DESC).

```typescript
// apps/web/src/components/room/room-timeline.tsx
"use client";

import * as React from "react";
import { useRoomTimeline } from "@/hooks/use-room-timeline";
import { RoomTimelineItem } from "./room-timeline-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

export function RoomTimeline({
  vacancyId,
  includeInternal = true,
}: {
  vacancyId: string;
  includeInternal?: boolean;
}) {
  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useRoomTimeline(vacancyId, includeInternal);

  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on initial load and new items
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.pages?.[0]?.items?.length]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Flatten pages and reverse to show oldest-first (API returns DESC)
  const allItems = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items).reverse();
  }, [data]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Load older */}
      {hasNextPage && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : null}
            Oudere berichten laden
          </Button>
        </div>
      )}

      {/* Timeline items */}
      <div className="flex-1 space-y-3 p-4">
        {allItems.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nog geen activiteit in deze room.
          </p>
        )}
        {allItems.map((item) => (
          <RoomTimelineItem key={item.id} item={item} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/room/room-timeline.tsx
git commit -m "feat(web): add RoomTimeline component with infinite scroll"
```

---

## Task 9: Frontend — Room Header

**Files:**
- Create: `apps/web/src/components/room/room-header.tsx`

- [ ] **Step 1: Create the room header component**

Displays: vacancy title, client/employer, open duration, candidate count, presence avatars, and a quick stats bar.

```typescript
// apps/web/src/components/room/room-header.tsx
"use client";

import { useRoomStats } from "@/hooks/use-room-stats";
import { PresenceAvatars } from "@/components/collaboration/presence-avatars";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle2, Calendar, AlertTriangle } from "lucide-react";
import type { Vacancy } from "@recruitment-os/types";

function StatCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  variant?: "default" | "warning";
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Icon
        className={`size-4 ${variant === "warning" ? "text-amber-500" : "text-muted-foreground"}`}
      />
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export function RoomHeader({
  vacancy,
  vacancyId,
}: {
  vacancy: Vacancy;
  vacancyId: string;
}) {
  const { data: stats, isLoading } = useRoomStats(vacancyId);

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      {/* Top row: title + presence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{vacancy.title}</h1>
          <Badge variant="outline" className="text-xs">
            {vacancy.status}
          </Badge>
          {vacancy.location && (
            <span className="text-sm text-muted-foreground">
              {vacancy.location}
            </span>
          )}
        </div>
        <PresenceAvatars vacancyId={vacancyId} />
      </div>

      {/* Stats bar */}
      <div className="mt-2 flex items-center gap-6">
        {isLoading ? (
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-20" />
            ))}
          </div>
        ) : stats ? (
          <>
            <StatCard icon={Users} label="totaal" value={stats.total} />
            <StatCard
              icon={CheckCircle2}
              label="geschikt"
              value={stats.qualified}
            />
            <StatCard icon={Calendar} label="interview" value={stats.interview} />
            <StatCard
              icon={AlertTriangle}
              label="overdue"
              value={stats.overdue}
              variant={stats.overdue > 0 ? "warning" : "default"}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/room/room-header.tsx
git commit -m "feat(web): add RoomHeader with stats bar and presence"
```

---

## Task 10: Frontend — Room Message Input

**Files:**
- Create: `apps/web/src/components/room/room-message-input.tsx`

- [ ] **Step 1: Create the room-specific message input**

Wraps the existing `CommentInput` pattern but posts to targetType="vacancy" and invalidates room-timeline cache on submit.

```typescript
// apps/web/src/components/room/room-message-input.tsx
"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MentionPicker } from "@/components/collaboration/mention-picker";
import { MentionChip } from "@/components/collaboration/mention-chip";
import { useCreateComment } from "@/hooks/use-comments";
import { Lock, Globe, Send } from "lucide-react";

export function RoomMessageInput({ vacancyId }: { vacancyId: string }) {
  const [body, setBody] = React.useState("");
  const [mentions, setMentions] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [isInternal, setIsInternal] = React.useState(true);
  const [mentionPickerOpen, setMentionPickerOpen] = React.useState(false);
  const createComment = useCreateComment();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);
    const lastChar = value.slice(-1);
    const prevChar = value.slice(-2, -1);
    if (
      lastChar === "@" &&
      (!prevChar || prevChar === " " || prevChar === "\n")
    ) {
      setMentionPickerOpen(true);
    }
  };

  const handleMentionSelect = (userId: string, userName: string) => {
    if (!mentions.find((m) => m.id === userId)) {
      setMentions((prev) => [...prev, { id: userId, name: userName }]);
    }
    setBody((prev) => {
      const lastAt = prev.lastIndexOf("@");
      return lastAt >= 0
        ? prev.slice(0, lastAt) + `@${userName} `
        : prev + `@${userName} `;
    });
    textareaRef.current?.focus();
  };

  const removeMention = (userId: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== userId));
  };

  const handleSubmit = async () => {
    if (!body.trim()) return;
    try {
      await createComment.mutateAsync({
        targetType: "vacancy",
        targetId: vacancyId,
        body: body.trim(),
        mentions: mentions.map((m) => m.id),
        isInternal,
      });
      setBody("");
      setMentions([]);
      // Invalidate room timeline so new comment appears
      qc.invalidateQueries({ queryKey: ["room-timeline", vacancyId] });
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="Schrijf een bericht... (Cmd+Enter om te versturen)"
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none pr-12"
        />
        <MentionPicker
          open={mentionPickerOpen}
          onOpenChange={setMentionPickerOpen}
          onSelect={handleMentionSelect}
        />
      </div>

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mentions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => removeMention(m.id)}
              className="cursor-pointer"
              title="Verwijder mention"
            >
              <MentionChip name={m.name} />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsInternal(!isInternal)}
          className="flex items-center gap-1"
        >
          <Badge variant="outline" className="cursor-pointer gap-1">
            {isInternal ? (
              <>
                <Lock className="size-3" />
                Intern
              </>
            ) : (
              <>
                <Globe className="size-3" />
                Gedeeld
              </>
            )}
          </Badge>
        </button>

        <Button
          onClick={handleSubmit}
          disabled={!body.trim() || createComment.isPending}
          size="sm"
          className="gap-1"
        >
          <Send className="size-3.5" />
          Verstuur
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/room/room-message-input.tsx
git commit -m "feat(web): add RoomMessageInput with mention support + Cmd+Enter"
```

---

## Task 11: Frontend — Room Timeline real-time sync

**Files:**
- Modify: `apps/web/src/hooks/use-socket.ts`

- [ ] **Step 1: Add useRoomTimelineSync hook**

This hook listens for Socket.IO events that should trigger a timeline refresh: `pipeline:update` (stage changes) and `notification:new` (new comments on this vacancy).

Read the current `use-socket.ts` file first to see the existing pattern, then add:

```typescript
// Add to apps/web/src/hooks/use-socket.ts (after the existing usePipelineSync function)

/**
 * Room timeline sync — invalidates room-timeline query
 * when pipeline events or new comments arrive for this vacancy.
 */
export function useRoomTimelineSync(vacancyId: string) {
  const { socket } = useSocketContext();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket || !vacancyId) return;

    const handlePipelineUpdate = () => {
      qc.invalidateQueries({ queryKey: ["room-timeline", vacancyId] });
      qc.invalidateQueries({ queryKey: ["room-stats", vacancyId] });
    };

    socket.on("pipeline:update", handlePipelineUpdate);
    return () => {
      socket.off("pipeline:update", handlePipelineUpdate);
    };
  }, [socket, vacancyId, qc]);
}
```

**Note:** Make sure `useQueryClient` is imported from `@tanstack/react-query` if not already. The existing `usePipelineSync` already imports `useEffect` from React and `useSocketContext`.

- [ ] **Step 2: Verify build**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter web build`
Expected: Clean build (or at least no TypeScript errors — Next.js build may fail on unrelated issues).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-socket.ts
git commit -m "feat(web): add useRoomTimelineSync for real-time timeline updates"
```

---

## Task 12: Frontend — Room Page (two-panel layout)

**Files:**
- Create: `apps/web/src/app/(app)/vacancies/[id]/room/page.tsx`

- [ ] **Step 1: Create a vacancy detail hook if needed**

Check if there's an existing `useVacancy(id)` hook. The vacancy list hook exists in `hooks/use-vacancies.ts`. If there is a `useVacancy` single-fetch hook, reuse it. If not, add one:

Read `apps/web/src/hooks/use-vacancies.ts` first. If it lacks a single-vacancy query, add to that file:

```typescript
export function useVacancy(id: string) {
  return useQuery<Vacancy>({
    queryKey: ["vacancy", id],
    queryFn: () => apiClient<Vacancy>(`/api/vacancies/${id}`),
    enabled: !!id,
  });
}
```

- [ ] **Step 2: Create the Room page**

```typescript
// apps/web/src/app/(app)/vacancies/[id]/room/page.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useVacancy } from "@/hooks/use-vacancies";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineFilters } from "@/components/pipeline/pipeline-filters";
import { RoomHeader } from "@/components/room/room-header";
import { RoomTimeline } from "@/components/room/room-timeline";
import { RoomMessageInput } from "@/components/room/room-message-input";
import { useRoomTimelineSync } from "@/hooks/use-socket";
import { Skeleton } from "@/components/ui/skeleton";
import type { PipelineFilters as Filters } from "@/hooks/use-pipeline";

export default function VacancyRoomPage() {
  const params = useParams<{ id: string }>();
  const vacancyId = params.id;
  const { data: vacancy, isLoading } = useVacancy(vacancyId);
  const [filters, setFilters] = useState<Filters>({});

  // Real-time sync for timeline
  useRoomTimelineSync(vacancyId);

  if (isLoading || !vacancy) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="mt-2 h-5 w-96" />
        </div>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Room header with stats */}
      <RoomHeader vacancy={vacancy} vacancyId={vacancyId} />

      {/* Two-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Pipeline */}
        <div className="flex w-3/5 flex-col border-r border-slate-200">
          <PipelineFilters onChange={setFilters} />
          <div className="flex-1 overflow-hidden">
            <PipelineBoard vacancyId={vacancyId} filters={filters} />
          </div>
        </div>

        {/* Right panel: Timeline */}
        <div className="flex w-2/5 flex-col bg-slate-50">
          <RoomTimeline vacancyId={vacancyId} />
          <RoomMessageInput vacancyId={vacancyId} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the page loads**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter web dev`

Navigate to `http://localhost:3002/vacancies/<any-vacancy-id>/room` in the browser.

Expected: Two-panel layout renders. Left panel shows pipeline board. Right panel shows timeline (may be empty). Header shows vacancy title and stats.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/vacancies/\[id\]/room/page.tsx
git add apps/web/src/hooks/use-vacancies.ts  # only if modified
git commit -m "feat(web): add Vacancy Room page with two-panel layout"
```

---

## Task 13: Add Room link to vacancy navigation

**Files:**
- Modify: `apps/web/src/app/(app)/vacancies/[id]/page.tsx`

The existing vacancy detail page has tabs. We need to add a prominent link/button to open the Room view.

- [ ] **Step 1: Read the current vacancy detail page**

Read `apps/web/src/app/(app)/vacancies/[id]/page.tsx` to understand the current tab structure.

- [ ] **Step 2: Add a "Room" link/button**

In the vacancy detail page header area, add a button that links to the Room:

```typescript
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

// In the header area of the vacancy detail page, add:
<Link href={`/vacancies/${params.id}/room`}>
  <Button variant="default" size="sm" className="gap-1.5">
    <MessageSquare className="size-4" />
    Open Room
  </Button>
</Link>
```

The exact placement depends on the current page structure — place it next to the existing "Pipeline board" link or in the page header actions area.

- [ ] **Step 3: Verify navigation works**

Navigate to a vacancy detail page, click "Open Room", verify it takes you to `/vacancies/[id]/room`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/vacancies/\[id\]/page.tsx
git commit -m "feat(web): add Room link to vacancy detail page"
```

---

## Task 14: Backend — Broadcast timeline events via Socket.IO

**Files:**
- Modify: `apps/api/src/lib/socket.ts`

Currently, `comment_added` activity log events exist but the Socket.IO layer only broadcasts `pipeline:update` for application-related domain events. We need to also broadcast when a new comment is created on a vacancy, so the Room timeline refreshes in real-time for other viewers.

- [ ] **Step 1: Read the current socket.ts**

Read `apps/api/src/lib/socket.ts` to understand the domain event subscription.

- [ ] **Step 2: Add comment broadcast**

In the `domainEvents.subscribe` handler in `socket.ts`, extend it to also listen for a new `comment.created` domain event type and broadcast to the vacancy room:

First, the comment service needs to emit a domain event. Modify `apps/api/src/services/comment.service.ts` — after the `withTenantContext` block in `createComment`, add:

```typescript
import { domainEvents } from "../lib/domain-events.js";

// After the return statement, before enqueuing email jobs:
if (input.targetType === "vacancy") {
  domainEvents.emit({
    type: "comment.created",
    orgId,
    targetType: input.targetType,
    targetId: input.targetId,
  });
}
```

Then in `apps/api/src/lib/socket.ts`, in the `domainEvents.subscribe` callback, add handling for `comment.created`:

```typescript
// Add after the pipeline events handler:
if (event.type === "comment.created") {
  io!.to(`tenant:${event.orgId}`).emit("pipeline:update", event);
}
```

We reuse the `pipeline:update` event name because the frontend `useRoomTimelineSync` already listens for it. This is intentional — it triggers a cache invalidation, which is all we need.

- [ ] **Step 3: Add `comment.created` to the DomainEvent type**

In `apps/api/src/lib/domain-events.ts`, add the new event type to the union:

```typescript
| { type: "comment.created"; orgId: string; targetType: string; targetId: string }
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/bartwilbrink/recruitment-os && pnpm --filter api build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/comment.service.ts apps/api/src/lib/socket.ts apps/api/src/lib/domain-events.ts
git commit -m "feat(api): broadcast comment.created events via Socket.IO for room sync"
```

---

## Task 15: End-to-end verification

- [ ] **Step 1: Start the development environment**

Run: `cd /Users/bartwilbrink/recruitment-os && docker compose up -d && pnpm dev`

Expected: API on :4000, Web on :3002.

- [ ] **Step 2: Navigate to Room**

Open `http://localhost:3002/vacancies/<vacancy-id>/room`.

Verify:
1. Room header shows vacancy title, status badge, location
2. Stats bar shows total/qualified/interview/overdue counts
3. Presence avatars appear (your own session)
4. Left panel: pipeline board with drag-and-drop columns
5. Right panel: timeline showing historical comments and events
6. Message input at bottom with internal/shared toggle

- [ ] **Step 3: Test real-time**

1. Post a message via the Room input
2. Verify it appears in the timeline without page refresh
3. Drag a candidate to a new stage on the pipeline
4. Verify a stage_changed event appears in the timeline

- [ ] **Step 4: Test internal/shared toggle**

1. Post a message with "Intern" badge active
2. Verify it shows with the lock icon in the timeline

- [ ] **Step 5: Test @mentions**

1. Type `@` in the message input
2. Verify mention picker appears with org members
3. Select a user, submit the message
4. Verify the message shows the mention inline

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during room e2e verification"
```
