import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  clearTokens,
  getAccessToken,
  getConversationMessages,
  listConversations,
  login,
  setTokens,
} from "./api-client.js";

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

  it("wraps a network-level failure (server unreachable) in a friendly ApiError instead of the raw browser error", async () => {
    // fetch() itself rejects on a connection failure — no Response at all.
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as never;

    await expect(login("user@example.com", "password123")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: expect.not.stringContaining("Failed to fetch"),
    });
  });
});

describe("conversations", () => {
  it("lists conversations from the unwrapped response envelope", async () => {
    setTokens("access-1", "refresh-1");
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ conversations: [{ id: "c1", title: "Hello", updatedAt: "2026-01-01T00:00:00Z" }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as never;

    const conversations = await listConversations();
    expect(conversations).toEqual([{ id: "c1", title: "Hello", updatedAt: "2026-01-01T00:00:00Z" }]);
  });

  it("fetches messages for a conversation from the unwrapped response envelope", async () => {
    setTokens("access-1", "refresh-1");
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ messages: [{ role: "user", content: "hi" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as never;

    const messages = await getConversationMessages("c1");
    expect(messages).toEqual([{ role: "user", content: "hi" }]);
  });
});
