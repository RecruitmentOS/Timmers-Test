import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";
import { type PgBoss } from "pg-boss";

const BACKUP_RETENTION_DAYS = Number.parseInt(
  process.env.BACKUP_RETENTION_DAYS ?? "30",
  10,
);
const BACKUP_PREFIX = process.env.BACKUP_S3_PREFIX ?? "backups/";

/**
 * Prune S3 backup objects older than the retention window.
 * Called after each successful upload to prevent unbounded storage growth.
 *
 * Exported for unit testing — accepts injectable `now` so tests can pin the clock.
 */
export async function pruneOldBackups(
  s3: S3Client,
  bucket: string,
  prefix: string = BACKUP_PREFIX,
  retentionDays: number = BACKUP_RETENTION_DAYS,
  now: Date = new Date(),
): Promise<{ deleted: string[]; kept: number }> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted: string[] = [];
  let kept = 0;
  let ContinuationToken: string | undefined = undefined;

  do {
    const list: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken,
      }),
    );
    for (const obj of list.Contents ?? []) {
      if (!obj.Key || !obj.LastModified) continue;
      if (obj.LastModified.getTime() < cutoff.getTime()) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }),
        );
        deleted.push(obj.Key);
      } else {
        kept++;
      }
    }
    ContinuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return { deleted, kept };
}

/**
 * Nightly database backup job — REL-03
 *
 * Runs pg_dump, gzips the output, uploads to S3-compatible storage.
 * Dormant-safe: skips if DATABASE_URL or S3 bucket is not configured.
 */
export async function runDatabaseBackup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const bucket =
    process.env.BACKUP_S3_BUCKET || process.env.S3_BUCKET;

  if (!databaseUrl) {
    console.warn(
      "[backup] DATABASE_URL not set — skipping nightly backup"
    );
    return;
  }

  if (!bucket) {
    console.warn(
      "[backup] BACKUP_S3_BUCKET / S3_BUCKET not set — skipping nightly backup"
    );
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `/tmp/recruitment-os-${timestamp}.sql.gz`;

  try {
    // Run pg_dump with gzip compression (5 minute timeout)
    execSync(`pg_dump "${databaseUrl}" | gzip > ${filename}`, {
      timeout: 300_000,
      stdio: "pipe",
    });

    // Verify file is not empty
    const fileBuffer = readFileSync(filename);
    if (fileBuffer.length === 0) {
      throw new Error("pg_dump produced empty backup file");
    }

    // Upload to S3-compatible storage
    const s3 = new S3Client({
      ...(process.env.S3_ENDPOINT
        ? {
            endpoint: process.env.S3_ENDPOINT,
            forcePathStyle: true,
          }
        : {}),
      region: process.env.S3_REGION || "eu-west-1",
    });

    const key = `backups/${timestamp}.sql.gz`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: "application/gzip",
      })
    );

    const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(
      `[backup] Uploaded ${key} (${sizeMB} MB) to bucket ${bucket}`
    );

    try {
      const prune = await pruneOldBackups(s3, bucket);
      console.log(
        `[backup] pruned ${prune.deleted.length} old backups (>${BACKUP_RETENTION_DAYS}d), kept ${prune.kept}`,
      );
    } catch (pruneErr) {
      // Prune failure must NOT fail the backup job — upload already succeeded.
      console.error("[backup] prune failed (upload already persisted):", pruneErr);
    }
  } finally {
    // Clean up temp file
    try {
      unlinkSync(filename);
    } catch {
      // File may not exist if pg_dump failed before creating it
    }
  }
}

/**
 * Register the nightly backup job with pg-boss.
 * Runs at 02:00 UTC every day with up to 3 retries and 1-hour expiry.
 */
export async function registerBackupJob(boss: PgBoss): Promise<void> {
  await boss.schedule(
    "nightly-backup",
    "0 2 * * *",
    {},
    { retryLimit: 3, expireInSeconds: 3600 }
  );

  await boss.work(
    "nightly-backup",
    { pollingIntervalSeconds: 60 },
    async () => {
      await runDatabaseBackup();
    }
  );

  console.log("[backup] Nightly backup job registered (02:00 UTC)");
}
