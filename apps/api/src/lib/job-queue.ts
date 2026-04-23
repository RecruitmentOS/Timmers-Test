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

  // pg-boss v12: queues must exist before workers can attach.
  // Pre-create all known queues so boss.work() + boss.send() don't fail.
  const KNOWN_QUEUES = [
    // intake
    "intake.start",
    "intake.reminder_24h",
    "intake.reminder_72h",
    "intake.no_response_farewell",
    "intake.process_message",
    "intake.fleks_pushback",
    // fleks sync
    "fleks.sync-tick",
    "fleks.sync-scheduler",
    // geo
    "geo.geocode_candidate",
    "geo.geocode_vacancy",
    // cv + docs + notifications
    "cv.parse",
    "send-notification-email",
    "doc.expiry_reminder",
    // scheduled
    "billing.monthly-usage",
    "billing.trial-reminder",
    "data-retention-check",
    "meta-insights-sync",
    "nightly-backup",
    // task scheduler
    "task.overdue_reminder",
    // nilo
    "nilo.start",
    "nilo.reminder_24h",
    "nilo.reminder_72h",
    "nilo.no_response_farewell",
    "nilo.process_inbound",
  ];
  for (const q of KNOWN_QUEUES) {
    try {
      await boss.createQueue(q);
    } catch (err) {
      // createQueue is idempotent in v12 but may throw on some versions
      if (!String(err).includes("already exists")) {
        console.warn(`[jobs] createQueue(${q}) warning:`, err);
      }
    }
  }
  console.log(`[jobs] ensured ${KNOWN_QUEUES.length} queues exist`);

  return boss;
}

export function getJobQueue(): PgBoss {
  if (!boss) {
    throw new Error("Job queue not started — call startJobQueue() first");
  }
  return boss;
}

/** Returns the job queue instance if started, or null if JOBS_ENABLED=false. */
export function tryGetJobQueue(): PgBoss | null {
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
