import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@omnira/core";
import { GroqSttProvider } from "./groq-stt-provider.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("GroqSttProvider", () => {
  it("returns the transcript from a successful response", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ text: "hello world" }), { status: 200 })) as never;

    const provider = new GroqSttProvider({ apiKey: "test-key" });
    const result = await provider.transcribe(Buffer.from("fake-audio"), "audio/webm");

    expect(result.text).toBe("hello world");
  });

  it("posts to Groq's OpenAI-compatible transcription endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "hi" }), { status: 200 }));
    global.fetch = fetchMock as never;

    const provider = new GroqSttProvider({ apiKey: "test-key" });
    await provider.transcribe(Buffer.from("fake-audio"), "audio/webm");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws an UpstreamError on a non-2xx response", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as never;

    const provider = new GroqSttProvider({ apiKey: "test-key" });
    await expect(provider.transcribe(Buffer.from("fake-audio"), "audio/webm")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("throws an UpstreamError when the network call itself fails", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as never;

    const provider = new GroqSttProvider({ apiKey: "test-key" });
    await expect(provider.transcribe(Buffer.from("fake-audio"), "audio/webm")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("throws an UpstreamError when the response has no transcript field", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as never;

    const provider = new GroqSttProvider({ apiKey: "test-key" });
    await expect(provider.transcribe(Buffer.from("fake-audio"), "audio/webm")).rejects.toBeInstanceOf(UpstreamError);
  });
});
