import { NotFoundError, UpstreamError, ValidationError } from "@omnira/core";
import type { PrismaClient } from "../db.js";
import { decryptToken, encryptToken } from "./crypto.js";
import { generatePkcePair, generateState } from "./pkce.js";
import type { OAuthProvider } from "./providers.js";

const STATE_TTL_MS = 10 * 60 * 1000;
/** Refresh this far ahead of the real expiry, so a request never races a token dying mid-flight. */
const REFRESH_SKEW_MS = 60 * 1000;
const DEFAULT_EXPIRY_SECONDS = 3600;

export interface IntegrationStatus {
  connected: boolean;
  scope: string | null;
  expiresAt: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Generic OAuth 2.0 Authorization Code + PKCE engine, parametrized by
 * OAuthProvider — both Google Calendar and Spotify are standard flows, so
 * this is the one implementation both routes call through rather than two
 * near-duplicate copies. State/PKCE round-trip through Postgres (OAuthState),
 * not memory, because apps/api runs as Netlify Functions in production (see
 * db.ts) where /connect and /callback can land on different Lambda instances.
 */
export class IntegrationsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly encryptionKey: string | undefined,
  ) {}

  private requireEncryptionKey(): string {
    if (!this.encryptionKey) {
      throw new UpstreamError("Integrations aren't configured on this server yet (missing INTEGRATION_ENCRYPTION_KEY).");
    }
    return this.encryptionKey;
  }

  async buildAuthorizeUrl(userId: string, provider: OAuthProvider, redirectUri: string): Promise<string> {
    const { verifier, challenge } = generatePkcePair();
    const state = generateState();

    await this.db.oAuthState.create({
      data: { state, userId, provider: provider.id, codeVerifier: verifier, expiresAt: new Date(Date.now() + STATE_TTL_MS) },
    });

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: provider.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...provider.extraAuthParams,
    });

    return `${provider.authorizeEndpoint}?${params.toString()}`;
  }

  /** Exchanges the authorize redirect's code for tokens and persists the connection. Returns the userId it belongs to, for the callback's confirmation page. */
  async handleCallback(provider: OAuthProvider, code: string, state: string, redirectUri: string): Promise<string> {
    const encryptionKey = this.requireEncryptionKey();

    const stateRow = await this.db.oAuthState.findUnique({ where: { state } });
    // Single-use: consume it on first sight regardless of what happens next,
    // so a replayed/leaked callback URL can never be redeemed twice.
    if (stateRow) await this.db.oAuthState.delete({ where: { state } }).catch(() => {});

    if (!stateRow || stateRow.provider !== provider.id || stateRow.expiresAt < new Date()) {
      throw new ValidationError("This connection link has expired or was already used — try connecting again.");
    }

    const tokens = await this.postToken(provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code_verifier: stateRow.codeVerifier,
    });

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? DEFAULT_EXPIRY_SECONDS) * 1000);
    await this.db.integrationConnection.upsert({
      where: { userId_provider: { userId: stateRow.userId, provider: provider.id } },
      create: {
        userId: stateRow.userId,
        provider: provider.id,
        accessToken: encryptToken(tokens.access_token, encryptionKey),
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token, encryptionKey) : null,
        expiresAt,
        scope: tokens.scope ?? provider.scope,
      },
      update: {
        accessToken: encryptToken(tokens.access_token, encryptionKey),
        // Some providers omit refresh_token on a later re-consent — keep the
        // previously stored one instead of wiping a still-valid one with null.
        ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token, encryptionKey) } : {}),
        expiresAt,
        scope: tokens.scope ?? provider.scope,
      },
    });

    return stateRow.userId;
  }

  async getStatus(userId: string, providerId: string): Promise<IntegrationStatus> {
    const connection = await this.db.integrationConnection.findUnique({
      where: { userId_provider: { userId, provider: providerId } },
      select: { scope: true, expiresAt: true },
    });
    if (!connection) return { connected: false, scope: null, expiresAt: null };
    return { connected: true, scope: connection.scope, expiresAt: connection.expiresAt.toISOString() };
  }

  async disconnect(userId: string, providerId: string): Promise<void> {
    await this.db.integrationConnection.deleteMany({ where: { userId, provider: providerId } });
  }

  /** A live access token, transparently refreshed first if it's expired or about to be. Throws NotFoundError if this provider was never connected. */
  async getValidAccessToken(userId: string, provider: OAuthProvider): Promise<string> {
    const encryptionKey = this.requireEncryptionKey();
    const connection = await this.db.integrationConnection.findUnique({
      where: { userId_provider: { userId, provider: provider.id } },
    });
    if (!connection) throw new NotFoundError(`${provider.label} isn't connected.`);

    if (connection.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
      return decryptToken(connection.accessToken, encryptionKey);
    }
    if (!connection.refreshToken) {
      throw new UpstreamError(`${provider.label}'s connection expired and can't be silently renewed — reconnect it.`);
    }

    const refreshed = await this.postToken(provider, {
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.refreshToken, encryptionKey),
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
    });

    await this.db.integrationConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptToken(refreshed.access_token, encryptionKey),
        ...(refreshed.refresh_token ? { refreshToken: encryptToken(refreshed.refresh_token, encryptionKey) } : {}),
        expiresAt: new Date(Date.now() + (refreshed.expires_in ?? DEFAULT_EXPIRY_SECONDS) * 1000),
      },
    });

    return refreshed.access_token;
  }

  private async postToken(provider: OAuthProvider, body: Record<string, string>): Promise<TokenResponse> {
    let response: Response;
    try {
      response = await fetch(provider.tokenEndpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      });
    } catch (err) {
      throw new UpstreamError(`Could not reach ${provider.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new UpstreamError(`${provider.label} rejected the token request (${response.status})`, { detail });
    }
    return (await response.json()) as TokenResponse;
  }
}
