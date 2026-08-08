import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * OAuth tokens are the one thing in this DB that grant real access to a
 * user's outside account (their actual Google Calendar / Spotify) — unlike
 * RefreshToken (hashed, write-only, we only ever need to verify possession),
 * these must be recoverable to make API calls, so hashing isn't an option.
 * AES-256-GCM at rest instead of plaintext in the (hosted, Neon) DB.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(encryptionKey: string): Buffer {
  return createHash("sha256").update(encryptionKey).digest();
}

/** Returns "iv:authTag:ciphertext", each base64 — stored verbatim in IntegrationConnection.accessToken/refreshToken. */
export function encryptToken(plaintext: string, encryptionKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptToken(stored: string, encryptionKey: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv(ALGORITHM, deriveKey(encryptionKey), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
