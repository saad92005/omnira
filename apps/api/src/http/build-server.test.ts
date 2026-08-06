import { describe, expect, it } from "vitest";
import { createRootLogger, loadConfig } from "@omnira/core";
import type { PrismaClient } from "../db.js";
import { buildServer } from "./build-server.js";

/**
 * CORS preflight and headers never touch the database, so a stub PrismaClient
 * is enough here — no live Postgres needed. Regression test for a real bug:
 * the desktop webview enforces CORS like any browser, and a missing
 * Access-Control-Allow-Origin header fails fetch() before any response is
 * readable (surfaces as a generic network error, not an HTTP status).
 */
function testServer() {
  const config = loadConfig({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
  });
  const logger = createRootLogger({ level: "fatal", name: "test" });
  return buildServer({ config, logger, db: {} as PrismaClient });
}

describe("CORS", () => {
  it("allows a preflight request from the Vite dev server origin", async () => {
    const app = testServer();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/v1/auth/register",
      headers: {
        origin: "http://localhost:1420",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:1420");
  });

  it("allows the packaged Tauri app's origin", async () => {
    const app = testServer();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/v1/auth/register",
      headers: {
        origin: "http://tauri.localhost",
        "access-control-request-method": "POST",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("http://tauri.localhost");
  });

  it("sets Access-Control-Allow-Origin on the actual response, not just the preflight", async () => {
    const app = testServer();
    const res = await app.inject({
      method: "GET",
      url: "/v1/health",
      headers: { origin: "http://localhost:1420" },
    });

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:1420");
  });

  it("rejects an origin outside the local-dev allowlist", async () => {
    const app = testServer();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/v1/auth/register",
      headers: {
        origin: "http://evil.example.com",
        "access-control-request-method": "POST",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
