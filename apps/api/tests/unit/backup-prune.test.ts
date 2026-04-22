import { describe, it, expect, vi } from "vitest";
import {
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { pruneOldBackups } from "../../src/jobs/backup.job.js";

function makeMockS3(objects: Array<{ Key: string; LastModified: Date }>) {
  const sent: unknown[] = [];
  const deleted: string[] = [];
  const send = vi.fn(async (cmd: unknown) => {
    sent.push(cmd);
    if (cmd instanceof ListObjectsV2Command) {
      return { Contents: objects, IsTruncated: false };
    }
    if (cmd instanceof DeleteObjectCommand) {
      // @ts-expect-error — runtime shape from SDK input
      deleted.push(cmd.input.Key);
      return {};
    }
    throw new Error("unexpected command");
  });
  return { client: { send } as unknown as import("@aws-sdk/client-s3").S3Client, sent, deleted };
}

describe("pruneOldBackups", () => {
  const NOW = new Date("2026-04-21T00:00:00Z");
  const bucket = "test-bucket";
  const prefix = "backups/";

  it("deletes objects older than 30 days and keeps fresh ones", async () => {
    const old1 = { Key: "backups/2026-03-01.sql.gz", LastModified: new Date("2026-03-01T00:00:00Z") };
    const old2 = { Key: "backups/2026-03-15.sql.gz", LastModified: new Date("2026-03-15T00:00:00Z") };
    const fresh = { Key: "backups/2026-04-20.sql.gz", LastModified: new Date("2026-04-20T00:00:00Z") };
    const mock = makeMockS3([old1, old2, fresh]);

    const result = await pruneOldBackups(mock.client, bucket, prefix, 30, NOW);

    expect(result.deleted).toEqual([old1.Key, old2.Key]);
    expect(result.kept).toBe(1);
    expect(mock.deleted).toEqual([old1.Key, old2.Key]);
  });

  it("keeps everything when retention window is larger than oldest object age", async () => {
    const obj = { Key: "backups/2026-04-10.sql.gz", LastModified: new Date("2026-04-10T00:00:00Z") };
    const mock = makeMockS3([obj]);

    const result = await pruneOldBackups(mock.client, bucket, prefix, 365, NOW);

    expect(result.deleted).toEqual([]);
    expect(result.kept).toBe(1);
  });

  it("returns empty result when bucket is empty", async () => {
    const mock = makeMockS3([]);
    const result = await pruneOldBackups(mock.client, bucket, prefix, 30, NOW);
    expect(result.deleted).toEqual([]);
    expect(result.kept).toBe(0);
  });

  it("respects the retention boundary precisely (object exactly 30 days old is kept)", async () => {
    const exactlyThirtyDays = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const obj = { Key: "backups/edge.sql.gz", LastModified: exactlyThirtyDays };
    const mock = makeMockS3([obj]);

    const result = await pruneOldBackups(mock.client, bucket, prefix, 30, NOW);

    // cutoff = NOW - 30d; objects with LastModified < cutoff are deleted.
    // An object at exactly NOW-30d is NOT strictly less than cutoff, so it is kept.
    expect(result.deleted).toEqual([]);
    expect(result.kept).toBe(1);
  });
});
