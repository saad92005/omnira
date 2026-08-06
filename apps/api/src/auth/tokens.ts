import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { UnauthorizedError } from "@omnira/core";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenPayload {
  sub: string;
}

export async function signAccessToken(userId: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(key);
}

/** Throws UnauthorizedError (never a raw jose error) on any invalid or expired token. */
export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload> {
  const key = new TextEncoder().encode(secret);
  try {
    const { payload } = await jwtVerify(token, key);
    if (typeof payload.sub !== "string") {
      throw new UnauthorizedError("Access token is missing a subject");
    }
    return { sub: payload.sub };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Access token is invalid or expired");
  }
}

export interface IssuedRefreshToken {
  /** The raw token — returned to the client once, never stored. */
  token: string;
  /** SHA-256 hex digest — what's persisted in the database. */
  tokenHash: string;
  expiresAt: Date;
}

export function issueRefreshToken(): IssuedRefreshToken {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
