import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  clearTokens,
  getAccessToken,
  getActiveCapabilities,
  getConversationMessages,
  listConversations,
  login,
  logout,
  setTokens,
  transcribeAudio,
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

describe("transcribeAudio", () => {
  it("names the uploaded file to match the recorded blob's real MIME type, not a hardcoded .webm", async () => {
    setTokens("access-1", "refresh-1");
    let capturedForm: FormData | undefined;
    global.fetch = vi.fn(async (_url, init) => {
      capturedForm = init?.body as FormData;
      return new Response(JSON.stringify({ text: "hello" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as never;

    // iOS Safari records audio/mp4, never audio/webm -- this is exactly the
    // case a hardcoded ".webm" filename got wrong.
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mp4" });
    const text = await transcribeAudio(audio);

    expect(text).toBe("hello");
    const file = capturedForm?.get("file") as File;
    expect(file.name).toBe("utterance.m4a");
  });

  it("falls back to .webm for an unrecognized or missing MIME type", async () => {
    setTokens("access-1", "refresh-1");
    let capturedForm: FormData | undefined;
    global.fetch = vi.fn(async (_url, init) => {
      capturedForm = init?.body as FormData;
      return new Response(JSON.stringify({ text: "hello" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as never;

    const audio = new Blob([new Uint8Array([1, 2, 3])]);
    await transcribeAudio(audio);

    const file = capturedForm?.get("file") as File;
    expect(file.name).toBe("utterance.webm");
  });
});

describe("token refresh", () => {
  it("silently refreshes an expired access token and retries the original request once", async () => {
    setTokens("expired-access", "refresh-1");
    const calls: string[] = [];
    global.fetch = vi.fn(async (url) => {
      const path = String(url);
      calls.push(path);
      if (path.endsWith("/auth/refresh")) {
        return new Response(JSON.stringify({ accessToken: "fresh-access", refreshToken: "refresh-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // /conversations: fail once (simulating the expired token), then succeed.
      const alreadyRefreshed = calls.filter((c) => c.includes("/conversations")).length > 1;
      if (!alreadyRefreshed) {
        return new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Access token is invalid or expired", requestId: "r1" } }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ conversations: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as never;

    const conversations = await listConversations();

    expect(conversations).toEqual([]);
    expect(getAccessToken()).toBe("fresh-access");
    // One failed /conversations call, one /auth/refresh call, one retried /conversations call.
    expect(calls.filter((c) => c.includes("/conversations")).length).toBe(2);
    expect(calls.filter((c) => c.includes("/auth/refresh")).length).toBe(1);
  });

  it("coalesces simultaneous refreshes from concurrent 401s into a single /auth/refresh call", async () => {
    setTokens("expired-access", "refresh-1");
    let refreshCalls = 0;
    global.fetch = vi.fn(async (url) => {
      const path = String(url);
      if (path.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return new Response(JSON.stringify({ accessToken: "fresh-access", refreshToken: "refresh-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (getAccessToken() === "expired-access") {
        return new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Access token is invalid or expired", requestId: "r1" } }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ conversations: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as never;

    // Two requests race in with the same expired token, like ChatView's boot burst.
    await Promise.all([listConversations(), listConversations()]);

    expect(refreshCalls).toBe(1);
  });

  it("clears tokens and stops retrying when the refresh token itself is dead", async () => {
    setTokens("expired-access", "dead-refresh");
    global.fetch = vi.fn(async (url) => {
      const path = String(url);
      if (path.endsWith("/auth/refresh")) {
        return new Response(
          JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Refresh token is invalid, expired, or already used", requestId: "r1" } }),
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Access token is invalid or expired", requestId: "r1" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }) as never;

    await expect(listConversations()).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    expect(getAccessToken()).toBeNull();
  });
});

describe("logout", () => {
  it("clears local tokens even if the server revoke call fails", async () => {
    setTokens("access-1", "refresh-1");
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as never;

    await logout();
    expect(getAccessToken()).toBeNull();
  });

  it("is a no-op network-wise when there's nothing to revoke", async () => {
    clearTokens();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as never;

    await logout();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getActiveCapabilities", () => {
  it("returns only the capabilities whose most recent grant is still active", async () => {
    setTokens("access-1", "refresh-1");
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            grants: [
              { capability: "microphone", revokedAt: null },
              { capability: "system_control", revokedAt: "2026-01-01T00:00:00Z" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ) as never;

    const active = await getActiveCapabilities();
    expect(active).toEqual(new Set(["microphone"]));
  });
});
