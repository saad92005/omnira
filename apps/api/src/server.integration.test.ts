import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRootLogger, loadConfig } from "@omnira/core";
import { createDbClient, type PrismaClient } from "./db.js";
import { buildServer } from "./http/build-server.js";

/**
 * Exercises the real HTTP surface against a real Postgres instance — the
 * api<->Postgres integration boundary required by master prompt §15.
 * Requires `docker compose up -d db` and a migrated database (see
 * apps/api/package.json `prisma:migrate`). Not run by `pnpm test`.
 */
describe("api integration: auth + permissions", () => {
  let db: PrismaClient;
  let app: ReturnType<typeof buildServer>;

  beforeAll(() => {
    const config = loadConfig();
    db = createDbClient(config.DATABASE_URL);
    app = buildServer({ config, logger: createRootLogger({ level: "fatal", name: "test" }), db });
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  it("GET /v1/health reports ok", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("registers, logs in, refreshes, and manages permission grants end to end", async () => {
    const email = `${randomUUID()}@example.test`;
    const password = "correct horse battery staple";

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password },
    });
    expect(register.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const { accessToken, refreshToken } = login.json() as { accessToken: string; refreshToken: string };

    const authHeader = { authorization: `Bearer ${accessToken}` };

    // No permission granted yet — voice should be unavailable.
    const before = await app.inject({ method: "GET", url: "/v1/chat/voice-available", headers: authHeader });
    expect(before.json()).toEqual({ voiceAvailable: false });

    const grant = await app.inject({
      method: "POST",
      url: "/v1/permissions/microphone/grant",
      headers: authHeader,
    });
    expect(grant.statusCode).toBe(200);

    const afterGrant = await app.inject({ method: "GET", url: "/v1/chat/voice-available", headers: authHeader });
    expect(afterGrant.json()).toEqual({ voiceAvailable: true });

    // Revoking halts the capability immediately (§3.3).
    const revoke = await app.inject({
      method: "POST",
      url: "/v1/permissions/microphone/revoke",
      headers: authHeader,
    });
    expect(revoke.statusCode).toBe(204);

    const afterRevoke = await app.inject({ method: "GET", url: "/v1/chat/voice-available", headers: authHeader });
    expect(afterRevoke.json()).toEqual({ voiceAvailable: false });

    // Refresh rotation: the old refresh token must no longer work.
    const refreshed = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);

    const reusedOldToken = await app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(reusedOldToken.statusCode).toBe(401);
  });

  it("rejects requests with no bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/permissions" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});
