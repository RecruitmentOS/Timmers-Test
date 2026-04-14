import { execSync } from "child_process";
import { readFileSync, unlinkSync } from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { type PgBoss } from "pg-boss";

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
