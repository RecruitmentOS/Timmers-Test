import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq, and } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { fileMetadata } from "../db/schema/index.js";

// Allowed content types for CV upload
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// S3-compatible endpoint: MinIO for local dev, R2 for production
const s3Endpoint = process.env.S3_ENDPOINT
  || (process.env.R2_ACCOUNT_ID
    ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined);

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: s3Endpoint,
  // forcePathStyle required for MinIO and other S3-compatible services
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.S3_BUCKET_NAME || process.env.R2_BUCKET_NAME || "recruitment-os";

export const fileService = {
  async getUploadUrl(
    orgId: string,
    entityType: string,
    entityId: string,
    filename: string,
    contentType: string
  ) {
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new Error(
        `Unsupported content type: ${contentType}. Allowed: ${ALLOWED_TYPES.join(", ")}`
      );
    }

    const key = `${orgId}/${entityType}/${entityId}/${crypto.randomUUID()}_${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return { url, key };
  },

  async getDownloadUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return getSignedUrl(s3, command, { expiresIn: 3600 });
  },

  async recordUpload(
    orgId: string,
    entityType: string,
    entityId: string,
    filename: string,
    contentType: string,
    sizeBytes: number,
    s3Key: string,
    uploadedBy: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [file] = await tx
        .insert(fileMetadata)
        .values({
          organizationId: orgId,
          entityType,
          entityId,
          filename,
          contentType,
          sizeBytes,
          s3Key,
          uploadedBy,
        })
        .returning();
      return file;
    });
  },

  async listFiles(orgId: string, entityType: string, entityId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(fileMetadata)
        .where(
          and(
            eq(fileMetadata.entityType, entityType),
            eq(fileMetadata.entityId, entityId)
          )
        );
    });
  },
};
