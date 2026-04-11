import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { metaConnections } from "../db/schema/campaigns.js";

// ============================================================
// Meta connection service — encrypted credential storage
// NO RLS (admin-only, like tenant_billing)
// Feature-flagged on META_ENCRYPTION_KEY env var
// ============================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from env. Returns null if not configured
 * (feature flag: Meta integration disabled).
 */
function getEncryptionKey(): Buffer | null {
  const hex = process.env.META_ENCRYPTION_KEY;
  if (!hex) return null;
  return Buffer.from(hex, "hex");
}

/**
 * Check if Meta integration is configured at the system level.
 */
export function isMetaSystemConfigured(): boolean {
  return !!process.env.META_ENCRYPTION_KEY;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns `iv:authTag:ciphertext` as base64-encoded string.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Meta integration not configured: META_ENCRYPTION_KEY is missing");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string (iv:authTag:ciphertext format).
 */
export function decrypt(encryptedStr: string): string {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Meta integration not configured: META_ENCRYPTION_KEY is missing");
  }

  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Save or update Meta connection credentials for an organization.
 * Encrypts the access token before storing.
 */
export async function saveMetaConnection(
  orgId: string,
  metaAdAccountId: string,
  accessToken: string,
  tokenExpiresAt?: Date | null
): Promise<void> {
  if (!isMetaSystemConfigured()) {
    throw new Error("Meta integration not configured: META_ENCRYPTION_KEY is missing");
  }

  const encryptedToken = encrypt(accessToken);

  // Upsert — unique on organization_id
  const existing = await db
    .select({ id: metaConnections.id })
    .from(metaConnections)
    .where(eq(metaConnections.organizationId, orgId));

  if (existing.length > 0) {
    await db
      .update(metaConnections)
      .set({
        metaAdAccountId,
        accessTokenEncrypted: encryptedToken,
        tokenExpiresAt: tokenExpiresAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(metaConnections.organizationId, orgId));
  } else {
    await db.insert(metaConnections).values({
      organizationId: orgId,
      metaAdAccountId,
      accessTokenEncrypted: encryptedToken,
      tokenExpiresAt: tokenExpiresAt ?? null,
    });
  }
}

/**
 * Get Meta connection for an organization, decrypting the token.
 * Returns null if no connection exists.
 */
export async function getMetaConnection(
  orgId: string
): Promise<{
  metaAdAccountId: string;
  accessToken: string;
  tokenExpiresAt: Date | null;
} | null> {
  if (!isMetaSystemConfigured()) {
    return null;
  }

  const rows = await db
    .select()
    .from(metaConnections)
    .where(eq(metaConnections.organizationId, orgId));

  if (rows.length === 0) return null;

  const row = rows[0];
  const accessToken = decrypt(row.accessTokenEncrypted);

  return {
    metaAdAccountId: row.metaAdAccountId,
    accessToken,
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

/**
 * Delete Meta connection credentials for an organization.
 */
export async function deleteMetaConnection(orgId: string): Promise<void> {
  await db
    .delete(metaConnections)
    .where(eq(metaConnections.organizationId, orgId));
}

/**
 * Check if a Meta connection exists for an organization (without decrypting).
 */
export async function isMetaConfigured(orgId: string): Promise<boolean> {
  const rows = await db
    .select({ id: metaConnections.id })
    .from(metaConnections)
    .where(eq(metaConnections.organizationId, orgId));

  return rows.length > 0;
}
