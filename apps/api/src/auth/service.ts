import { ConflictError, UnauthorizedError } from "@omnira/core";
import type { PrismaClient } from "../db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { hashRefreshToken, issueRefreshToken, signAccessToken } from "./tokens.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthConfig {
  jwtAccessSecret: string;
}

export class AuthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly config: AuthConfig,
  ) {}

  async register(email: string, password: string): Promise<{ userId: string }> {
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await this.db.user.create({ data: { email, passwordHash } });
    return { userId: user.id };
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password");
    }
    return this.issueTokenPair(user.id);
  }

  /** Redeems a refresh token, rotating it: the old token is revoked and a new pair is issued. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(refreshToken);
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedError("Refresh token is invalid, expired, or already used");
    }

    const next = issueRefreshToken();
    // Sequential, not $transaction([...]) -- Neon's HTTP driver adapter
    // (apps/api/src/db.ts) rejects Prisma transactions outright, confirmed
    // live in production. Worst case on a crash between these two calls is
    // an old token revoked with no replacement issued yet, which just forces
    // a fresh login -- not a security gap (the old token is still consumed,
    // not left valid).
    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: next.tokenHash },
    });
    await this.db.refreshToken.create({
      data: { userId: stored.userId, tokenHash: next.tokenHash, expiresAt: next.expiresAt },
    });

    const accessToken = await signAccessToken(stored.userId, this.config.jwtAccessSecret);
    return { accessToken, refreshToken: next.token };
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(userId: string): Promise<AuthTokens> {
    const refresh = issueRefreshToken();
    await this.db.refreshToken.create({
      data: { userId, tokenHash: refresh.tokenHash, expiresAt: refresh.expiresAt },
    });
    const accessToken = await signAccessToken(userId, this.config.jwtAccessSecret);
    return { accessToken, refreshToken: refresh.token };
  }
}
