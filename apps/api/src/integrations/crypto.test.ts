import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto.js";

describe("encryptToken / decryptToken", () => {
  it("round-trips a plaintext token", () => {
    const ciphertext = encryptToken("ya29.a0AfH6SMB...", "a-secret-key");
    expect(decryptToken(ciphertext, "a-secret-key")).toBe("ya29.a0AfH6SMB...");
  });

  it("produces different ciphertext for the same plaintext on each call (random IV)", () => {
    const a = encryptToken("same-token", "key");
    const b = encryptToken("same-token", "key");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", () => {
    const ciphertext = encryptToken("secret-token", "correct-key");
    expect(() => decryptToken(ciphertext, "wrong-key")).toThrow();
  });

  it("fails to decrypt tampered ciphertext (auth tag mismatch)", () => {
    const ciphertext = encryptToken("secret-token", "key");
    const [iv, authTag, body] = ciphertext.split(":");
    const tampered = [iv, authTag, `${body?.slice(0, -2)}zz`].join(":");
    expect(() => decryptToken(tampered, "key")).toThrow();
  });
});
