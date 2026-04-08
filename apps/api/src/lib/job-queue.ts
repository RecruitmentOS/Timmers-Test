import { PgBoss } from "pg-boss";

/**
 * pg-boss singleton.
 *
 * Use synchronous in-transaction inserts for critical tenant data
 * (e.g. auto-creating a task when an application moves stage).
 * Use pg-boss ONLY for delayed/async work (e.g. overdue reminders).
 *
 * Boot with `startJobQueue()` from apps/api/src/index.ts BEFORE `serve(...)`.
 * Gated by `JOBS_ENABLED=true` so dev can opt out entirely when not needed.
 * SIGTERM / SIGINT trigger a graceful shutdown with a 5s drain window.
 */
let boss: PgBoss | null = null;

export async function startJobQueue(): Promise<PgBoss | null> {
  if (boss) return boss;

  if (process.env.JOBS_ENABLED !== "true") {
    console.log("[jobs] disabled (set JOBS_ENABLED=true to enable)");
    return null;
  }

  // pg-boss v12: retention/deletion are now queue-level options.
  // Constructor only takes database + scheduling + maintenance options.
  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: "pgboss",
    application_name: "recruitment-os-api",
    monitorIntervalSeconds: 30,
  });

  boss.on("error", (err: Error) =>
    console.error("[jobs] pg-boss error:", err)
  );
  await boss.start();
  console.log("[jobs] pg-boss started on schema 'pgboss'");
  return boss;
}

export function getJobQueue(): PgBoss {
  if (!boss) {
    throw new Error("Job queue not started — call startJobQueue() first");
  }
  return boss;
}

async function shutdown(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 5000 });
    boss = null;
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
