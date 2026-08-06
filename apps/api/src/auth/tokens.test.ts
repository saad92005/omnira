import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@omnira/core";
import { hashRefreshToken, issueRefreshToken, signAccessToken, verifyAccessToken } from "./tokens.js";

const SECRET = "a".repeat(32);

describe("access tokens", () => {
  it("round-trips the user id through sign and verify", async () => {
    const token = await signAccessToken("user-123", SECRET);
    const payload = await verifyAccessToken(token, SECRET);
    expect(payload.sub).toBe("user-123");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signAccessToken("user-123", SECRET);
    await expect(verifyAccessToken(token, "b".repeat(32))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a garbage token", async () => {
    await expect(verifyAccessToken("not-a-jwt", SECRET)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("refresh tokens", () => {
  it("issues a token whose hash matches hashRefreshToken(token)", () => {
    const issued = issueRefreshToken();
    expect(issued.tokenHash).toBe(hashRefreshToken(issued.token));
  });

  it("sets an expiry roughly 30 days out", () => {
    const issued = issueRefreshToken();
    const days = (issued.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it("generates distinct tokens on each call", () => {
    const a = issueRefreshToken();
    const b = issueRefreshToken();
    expect(a.token).not.toBe(b.token);
  });
});
