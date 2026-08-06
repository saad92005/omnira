import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@omnira/core";
import { OpenAiTtsProvider } from "./openai-tts-provider.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("OpenAiTtsProvider", () => {
  it("returns audio bytes from a successful response", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    global.fetch = vi.fn(async () => new Response(fakeAudio, { status: 200 })) as never;

    const provider = new OpenAiTtsProvider({ apiKey: "test-key" });
    const result = await provider.synthesize("hello");

    expect(result.mimeType).toBe("audio/mpeg");
    expect(Array.from(result.audio)).toEqual([1, 2, 3, 4]);
  });

  it("throws an UpstreamError on a non-2xx response", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as never;

    const provider = new OpenAiTtsProvider({ apiKey: "test-key" });
    await expect(provider.synthesize("hello")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("throws an UpstreamError when the network call itself fails", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as never;

    const provider = new OpenAiTtsProvider({ apiKey: "test-key" });
    await expect(provider.synthesize("hello")).rejects.toBeInstanceOf(UpstreamError);
  });
});
