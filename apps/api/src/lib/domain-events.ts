/**
 * Phase 2 domain events — thin in-process pub/sub abstraction.
 *
 * Every Phase 2 mutation (stage move, qualification verdict, bulk action,
 * task create/update/complete) MUST emit a DomainEvent via `domainEvents.emit(...)`.
 *
 * Phase 3 attaches a single Socket.IO subscriber to this bus to broadcast
 * realtime updates to connected clients — no service-layer refactor needed.
 *
 * Rules:
 * - emit() is fire-and-forget; subscriber errors are caught and logged so
 *   they never break the originating mutation.
 * - Never emit inside a transaction boundary where failure would require rollback;
 *   subscribers are async and may run after commit.
 * - All events carry `orgId` so Phase 3 can scope Socket.IO rooms to the tenant.
 */

export type DomainEvent =
  | { type: "application.created"; orgId: string; id: string; vacancyId: string }
  | {
      type: "application.stage_changed";
      orgId: string;
      id: string;
      vacancyId: string;
      fromStageId: string | null;
      toStageId: string;
    }
  | { type: "application.qualified"; orgId: string; id: string; status: string }
  | { type: "application.bulk_move"; orgId: string; ids: string[] }
  | { type: "application.bulk_reject"; orgId: string; ids: string[] }
  | { type: "application.bulk_assign"; orgId: string; ids: string[] }
  | { type: "application.bulk_tag"; orgId: string; ids: string[] }
  | { type: "task.created"; orgId: string; id: string }
  | { type: "task.updated"; orgId: string; id: string }
  | { type: "task.completed"; orgId: string; id: string };

type Subscriber = (event: DomainEvent) => void | Promise<void>;

const subscribers: Subscriber[] = [];

export const domainEvents = {
  emit(event: DomainEvent): void {
    for (const sub of subscribers) {
      Promise.resolve(sub(event)).catch((err) =>
        console.error("[domainEvents] subscriber error:", err)
      );
    }
  },

  subscribe(sub: Subscriber): () => void {
    subscribers.push(sub);
    return () => {
      const i = subscribers.indexOf(sub);
      if (i >= 0) subscribers.splice(i, 1);
    };
  },

  /** Test helper: reset subscribers between tests. */
  _reset(): void {
    subscribers.length = 0;
  },
};
