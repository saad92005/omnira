import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@omnira/core";

const createMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: createMock } };
    },
  };
});

const { GroqProvider } = await import("./groq-provider.js");

function fakeStream(chunks: Array<{ content?: string; usage?: { prompt_tokens: number; completion_tokens: number } }>) {
  return (async function* () {
    for (const chunk of chunks) {
      yield {
        model: "llama-3.3-70b-versatile",
        choices: [{ delta: { content: chunk.content } }],
        usage: chunk.usage,
      };
    }
  })();
}

describe("GroqProvider", () => {
  it("streams text deltas and returns the assembled final result", async () => {
    createMock.mockResolvedValue(
      fakeStream([
        { content: "Hel" },
        { content: "lo" },
        { usage: { prompt_tokens: 10, completion_tokens: 2 } },
      ]),
    );

    const provider = new GroqProvider({ apiKey: "test-key" });
    const collected: string[] = [];
    const result = await provider.generateReply([{ role: "user", content: "hi" }], (delta) =>
      collected.push(delta.text),
    );

    expect(collected).toEqual(["Hel", "lo"]);
    expect(result).toEqual({
      text: "Hello",
      model: "llama-3.3-70b-versatile",
      usage: { inputTokens: 10, outputTokens: 2 },
    });
  });

  it("defaults to the llama-3.3-70b-versatile model and Groq's OpenAI-compatible base URL", async () => {
    createMock.mockResolvedValue(fakeStream([]));
    const provider = new GroqProvider({ apiKey: "test-key" });
    await provider.generateReply([{ role: "user", content: "hi" }], () => {});

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ model: "llama-3.3-70b-versatile" }));
  });

  it("wraps a failed request in an UpstreamError rather than leaking the raw SDK error", async () => {
    createMock.mockRejectedValue(new Error("network down"));
    const provider = new GroqProvider({ apiKey: "test-key" });

    await expect(provider.generateReply([{ role: "user", content: "hi" }], () => {})).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });
});
