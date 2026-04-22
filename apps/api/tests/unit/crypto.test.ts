import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "../../src/lib/crypto.js";

describe("crypto helpers", () => {
  beforeAll(() => {
    process.env.SECRET_ENCRYPTION_KEY = "0".repeat(64); // 32 bytes hex
  });

  it("roundtrips a secret", () => {
    const enc = encryptSecret("super-secret-api-key");
    expect(enc).not.toContain("super-secret");
    const dec = decryptSecret(enc);
    expect(dec).toBe("super-secret-api-key");
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const a = encryptSecret("hello");
    const b = encryptSecret("hello");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("hello");
    expect(decryptSecret(b)).toBe("hello");
  });
});
