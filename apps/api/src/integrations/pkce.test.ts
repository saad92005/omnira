import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generatePkcePair, generateState } from "./pkce.js";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("generatePkcePair", () => {
  it("derives the challenge as base64url(sha256(verifier)), per RFC 7636 S256", () => {
    const { verifier, challenge } = generatePkcePair();
    expect(challenge).toBe(base64url(createHash("sha256").update(verifier).digest()));
  });

  it("is base64url only — no padding or URL-unsafe characters", () => {
    const { verifier, challenge } = generatePkcePair();
    for (const value of [verifier, challenge]) {
      expect(value).not.toMatch(/[+/=]/);
    }
  });

  it("generates a fresh verifier every call", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });
});

describe("generateState", () => {
  it("generates a fresh, URL-safe state token every call", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/[+/=]/);
  });
});
