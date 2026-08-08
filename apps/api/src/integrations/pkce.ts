import { createHash, randomBytes } from "node:crypto";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE (RFC 7636) S256 pair — the verifier goes in OAuthState (server-side only), the challenge goes in the authorize URL. */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** CSRF token for the OAuth round trip — also doubles as the OAuthState row's primary key. */
export function generateState(): string {
  return base64url(randomBytes(24));
}
