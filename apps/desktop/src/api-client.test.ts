import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearTokens, getAccessToken, login, setTokens } from "./api-client.js";

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("api-client token storage", () => {
  it("stores and retrieves the access token", () => {
    setTokens("access-1", "refresh-1");
    expect(getAccessToken()).toBe("access-1");
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});

describe("login", () => {
  it("stores the returned tokens on success", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ accessToken: "a", refreshToken: "r" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as never;

    await login("user@example.com", "password123");
    expect(getAccessToken()).toBe("a");
  });

  it("throws an ApiError carrying the server error code on failure", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Invalid email or password", requestId: "r1" } }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
    ) as never;

    await expect(login("user@example.com", "wrong")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(login("user@example.com", "wrong")).rejects.toBeInstanceOf(ApiError);
  });
});
