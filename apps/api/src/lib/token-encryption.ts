import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ============================================================
// Shared AES-256-GCM token encryption utility
// Used by calendar connections and any future OAuth integrations.
// Same pattern as meta-connection.service.ts, extracted for reuse.
// ============================================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard

/**
 * Get the encryption key from env.
 * Prefers CALENDAR_ENCRYPTION_KEY, falls back to META_ENCRYPTION_KEY.
 */
function getEncryptionKey(): Buffer {
  const hex =
    process.env.CALENDAR_ENCRYPTION_KEY || process.env.META_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "Encryption key not configured: set CALENDAR_ENCRYPTION_KEY or META_ENCRYPTION_KEY (32-byte hex)"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns `iv:authTag:ciphertext` as base64-encoded string.
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
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
export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey();

  const parts = encrypted.split(":");
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
 * Check if encryption is configured at the system level.
 */
export function isEncryptionConfigured(): boolean {
  return !!(
    process.env.CALENDAR_ENCRYPTION_KEY || process.env.META_ENCRYPTION_KEY
  );
}
