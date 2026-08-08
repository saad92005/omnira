import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../db.js";
import { decryptToken, encryptToken } from "./crypto.js";
import { IntegrationsService } from "./oauth-service.js";
import type { OAuthProvider } from "./providers.js";

const ENCRYPTION_KEY = "test-encryption-key";

const PROVIDER: OAuthProvider = {
  id: "google_calendar",
  label: "Test Provider",
  authorizeEndpoint: "https://example.test/authorize",
  tokenEndpoint: "https://example.test/token",
  scope: "test.scope",
  clientId: "client-123",
  clientSecret: "client-secret",
  extraAuthParams: { access_type: "offline" },
};

interface FakeConnection {
  id: string;
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
}

interface FakeStateRow {
  state: string;
  userId: string;
  provider: string;
  codeVerifier: string;
  expiresAt: Date;
}

/** In-memory double for the two Prisma models this service touches — mirrors real method signatures closely enough (including delete-on-missing throwing) to exercise the service's actual control flow. */
function fakeDb() {
  const states = new Map<string, FakeStateRow>();
  const connections = new Map<string, FakeConnection>();
  let nextId = 1;
  const key = (userId: string, provider: string) => `${userId}:${provider}`;

  const db = {
    oAuthState: {
      create: vi.fn(async ({ data }: { data: FakeStateRow }) => {
        states.set(data.state, { ...data });
        return data;
      }),
      findUnique: vi.fn(async ({ where: { state } }: { where: { state: string } }) => states.get(state) ?? null),
      delete: vi.fn(async ({ where: { state } }: { where: { state: string } }) => {
        if (!states.has(state)) throw new Error("Row not found");
        const row = states.get(state);
        states.delete(state);
        return row;
      }),
    },
    integrationConnection: {
      upsert: vi.fn(
        async ({
          where: {
            userId_provider: { userId, provider },
          },
          create,
          update,
        }: {
          where: { userId_provider: { userId: string; provider: string } };
          create: Omit<FakeConnection, "id">;
          update: Partial<FakeConnection>;
        }) => {
          const k = key(userId, provider);
          const existing = connections.get(k);
          const row: FakeConnection = existing
            ? { ...existing, ...update }
            : { id: String(nextId++), ...create };
          connections.set(k, row);
          return row;
        },
      ),
      findUnique: vi.fn(
        async ({ where: { userId_provider } }: { where: { userId_provider: { userId: string; provider: string } } }) =>
          connections.get(key(userId_provider.userId, userId_provider.provider)) ?? null,
      ),
      deleteMany: vi.fn(async ({ where: { userId, provider } }: { where: { userId: string; provider: string } }) => {
        connections.delete(key(userId, provider));
        return { count: 1 };
      }),
      update: vi.fn(async ({ where: { id }, data }: { where: { id: string }; data: Partial<FakeConnection> }) => {
        const existing = [...connections.values()].find((c) => c.id === id);
        if (!existing) throw new Error("Row not found");
        const row = { ...existing, ...data };
        connections.set(key(row.userId, row.provider), row);
        return row;
      }),
    },
  };

  return db as unknown as PrismaClient;
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("IntegrationsService", () => {
  let db: PrismaClient;
  let service: IntegrationsService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = fakeDb();
    service = new IntegrationsService(db, ENCRYPTION_KEY);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  describe("buildAuthorizeUrl", () => {
    it("builds a PKCE authorize URL and persists the matching state row", async () => {
      const url = await service.buildAuthorizeUrl("user-1", PROVIDER, "https://app.test/callback");
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe(PROVIDER.authorizeEndpoint);
      expect(parsed.searchParams.get("client_id")).toBe(PROVIDER.clientId);
      expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.test/callback");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("scope")).toBe(PROVIDER.scope);
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(parsed.searchParams.get("access_type")).toBe("offline");

      const state = parsed.searchParams.get("state");
      expect(state).toBeTruthy();
      const row = await db.oAuthState.findUnique({ where: { state: state as string } });
      expect(row?.userId).toBe("user-1");
      expect(row?.provider).toBe(PROVIDER.id);
    });
  });

  describe("handleCallback", () => {
    async function seedState(overrides: Partial<FakeStateRow> = {}): Promise<string> {
      const url = await service.buildAuthorizeUrl("user-1", PROVIDER, "https://app.test/callback");
      const state = new URL(url).searchParams.get("state") as string;
      if (Object.keys(overrides).length > 0) {
        const row = await db.oAuthState.findUnique({ where: { state } });
        await db.oAuthState.delete({ where: { state } });
        await db.oAuthState.create({ data: { ...row, ...overrides, state } as FakeStateRow });
      }
      return state;
    }

    it("exchanges the code, stores encrypted tokens, and returns the owning userId", async () => {
      const state = await seedState();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ access_token: "real-access-token", refresh_token: "real-refresh-token", expires_in: 3600, scope: "test.scope" }),
      );

      const userId = await service.handleCallback(PROVIDER, "auth-code", state, "https://app.test/callback");
      expect(userId).toBe("user-1");

      const connection = await db.integrationConnection.findUnique({
        where: { userId_provider: { userId: "user-1", provider: PROVIDER.id } },
      });
      expect(connection).toBeTruthy();
      expect(decryptToken((connection as FakeConnection).accessToken, ENCRYPTION_KEY)).toBe("real-access-token");
      expect(decryptToken((connection as FakeConnection).refreshToken as string, ENCRYPTION_KEY)).toBe("real-refresh-token");

      // Single-use: the state row must be gone after a successful exchange.
      expect(await db.oAuthState.findUnique({ where: { state } })).toBeNull();
    });

    it("rejects a replayed callback (state already consumed)", async () => {
      const state = await seedState();
      fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: "t", expires_in: 3600 }));
      await service.handleCallback(PROVIDER, "auth-code", state, "https://app.test/callback");

      await expect(service.handleCallback(PROVIDER, "auth-code", state, "https://app.test/callback")).rejects.toThrow();
    });

    it("rejects an expired state row", async () => {
      const state = await seedState({ expiresAt: new Date(Date.now() - 1000) });
      await expect(service.handleCallback(PROVIDER, "auth-code", state, "https://app.test/callback")).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an unknown state", async () => {
      await expect(service.handleCallback(PROVIDER, "auth-code", "not-a-real-state", "https://app.test/callback")).rejects.toThrow();
    });
  });

  describe("getStatus / disconnect", () => {
    it("reports not connected, then connected after a successful callback, then not connected after disconnect", async () => {
      expect((await service.getStatus("user-1", PROVIDER.id)).connected).toBe(false);

      const url = await service.buildAuthorizeUrl("user-1", PROVIDER, "https://app.test/callback");
      const state = new URL(url).searchParams.get("state") as string;
      fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: "t", expires_in: 3600, scope: "test.scope" }));
      await service.handleCallback(PROVIDER, "code", state, "https://app.test/callback");

      expect((await service.getStatus("user-1", PROVIDER.id)).connected).toBe(true);

      await service.disconnect("user-1", PROVIDER.id);
      expect((await service.getStatus("user-1", PROVIDER.id)).connected).toBe(false);
    });
  });

  describe("getValidAccessToken", () => {
    it("throws NotFoundError when the provider was never connected", async () => {
      await expect(service.getValidAccessToken("user-1", PROVIDER)).rejects.toMatchObject({ name: "NotFoundError" });
    });

    it("returns the stored token without refreshing when it isn't near expiry", async () => {
      await db.integrationConnection.upsert({
        where: { userId_provider: { userId: "user-1", provider: PROVIDER.id } },
        create: {
          userId: "user-1",
          provider: PROVIDER.id,
          accessToken: encryptForTest("still-valid"),
          refreshToken: null,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          scope: PROVIDER.scope,
        },
        update: {},
      } as never);

      const token = await service.getValidAccessToken("user-1", PROVIDER);
      expect(token).toBe("still-valid");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refreshes when the token is expired, and persists the new one", async () => {
      await db.integrationConnection.upsert({
        where: { userId_provider: { userId: "user-1", provider: PROVIDER.id } },
        create: {
          userId: "user-1",
          provider: PROVIDER.id,
          accessToken: encryptForTest("stale"),
          refreshToken: encryptForTest("refresh-me"),
          expiresAt: new Date(Date.now() - 1000),
          scope: PROVIDER.scope,
        },
        update: {},
      } as never);
      fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: "fresh-token", expires_in: 3600 }));

      const token = await service.getValidAccessToken("user-1", PROVIDER);
      expect(token).toBe("fresh-token");

      const [, options] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
      expect((options.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
      expect((options.body as URLSearchParams).get("refresh_token")).toBe("refresh-me");

      const stored = await db.integrationConnection.findUnique({ where: { userId_provider: { userId: "user-1", provider: PROVIDER.id } } });
      expect(decryptToken((stored as FakeConnection).accessToken, ENCRYPTION_KEY)).toBe("fresh-token");
    });

    it("throws UpstreamError when expired with no refresh token", async () => {
      await db.integrationConnection.upsert({
        where: { userId_provider: { userId: "user-1", provider: PROVIDER.id } },
        create: {
          userId: "user-1",
          provider: PROVIDER.id,
          accessToken: encryptForTest("stale"),
          refreshToken: null,
          expiresAt: new Date(Date.now() - 1000),
          scope: PROVIDER.scope,
        },
        update: {},
      } as never);

      await expect(service.getValidAccessToken("user-1", PROVIDER)).rejects.toMatchObject({ name: "UpstreamError" });
    });
  });
});

function encryptForTest(plaintext: string): string {
  return encryptToken(plaintext, ENCRYPTION_KEY);
}
