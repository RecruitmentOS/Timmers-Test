import { eq, and, lte, gte } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { fileMetadata } from "../db/schema/index.js";
import { getJobQueue } from "../lib/job-queue.js";

export const documentService = {
  async uploadDocument(
    orgId: string,
    candidateId: string,
    filename: string,
    contentType: string,
    sizeBytes: number,
    s3Key: string,
    uploadedBy: string,
    documentType: string,
    expiresAt?: string | null,
    contentHash?: string | null
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [doc] = await tx
        .insert(fileMetadata)
        .values({
          organizationId: orgId,
          entityType: "candidate",
          entityId: candidateId,
          filename,
          contentType,
          sizeBytes,
          s3Key,
          uploadedBy,
          documentType,
          expiresAt: expiresAt ?? null,
          contentHash: contentHash ?? null,
        })
        .returning();

      // Schedule pg-boss expiry reminders if expiresAt is set
      if (expiresAt) {
        const expiryDate = new Date(expiresAt);
        const now = new Date();
        const reminderDays = [30, 14, 7];

        for (const days of reminderDays) {
          const reminderDate = new Date(expiryDate);
          reminderDate.setDate(reminderDate.getDate() - days);

          // Only schedule reminders in the future
          if (reminderDate > now) {
            try {
              const boss = getJobQueue();
              await boss.send(
                "doc.expiry_reminder",
                {
                  documentId: doc.id,
                  candidateId,
                  orgId,
                  daysUntilExpiry: days,
                },
                {
                  startAfter: reminderDate.toISOString(),
                  singletonKey: `doc-expiry-${doc.id}-${days}d`,
                }
              );
            } catch {
              // Job queue may not be running in dev — log and continue
              console.log(
                `[document] Could not schedule ${days}d expiry reminder for doc ${doc.id} — job queue may be disabled`
              );
            }
          }
        }
      }

      return doc;
    });
  },

  async listDocuments(orgId: string, candidateId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(fileMetadata)
        .where(
          and(
            eq(fileMetadata.entityType, "candidate"),
            eq(fileMetadata.entityId, candidateId)
          )
        );
    });
  },

  async getExpiringDocuments(orgId: string, daysAhead: number) {
    return withTenantContext(orgId, async (tx) => {
      const today = new Date().toISOString().split("T")[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      return tx
        .select()
        .from(fileMetadata)
        .where(
          and(
            gte(fileMetadata.expiresAt, today),
            lte(fileMetadata.expiresAt, futureDateStr)
          )
        );
    });
  },

  async findByContentHash(orgId: string, hash: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(fileMetadata)
        .where(eq(fileMetadata.contentHash, hash));
      return rows[0] ?? null;
    });
  },
};
