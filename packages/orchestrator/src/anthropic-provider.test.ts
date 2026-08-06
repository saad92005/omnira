import { describe, expect, it, vi } from "vitest";
import { UpstreamError } from "@omnira/core";

const streamMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { stream: streamMock };
    },
  };
});

const { AnthropicProvider } = await import("./anthropic-provider.js");

function fakeStream(deltas: string[], final: { model: string; text: string; inputTokens: number; outputTokens: number }) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const text of deltas) {
        yield { type: "content_block_delta", delta: { type: "text_delta", text } };
      }
    },
    finalMessage: async () => ({
      model: final.model,
      content: [{ type: "text", text: final.text }],
      usage: { input_tokens: final.inputTokens, output_tokens: final.outputTokens },
    }),
  };
}

describe("AnthropicProvider", () => {
  it("streams text deltas and returns the assembled final result", async () => {
    streamMock.mockReturnValue(
      fakeStream(["Hel", "lo"], { model: "claude-opus-5", text: "Hello", inputTokens: 10, outputTokens: 2 }),
    );

    const provider = new AnthropicProvider({ apiKey: "test-key" });
    const collected: string[] = [];
    const result = await provider.generateReply([{ role: "user", content: "hi" }], (delta) =>
      collected.push(delta.text),
    );

    expect(collected).toEqual(["Hel", "lo"]);
    expect(result).toEqual({
      text: "Hello",
      model: "claude-opus-5",
      usage: { inputTokens: 10, outputTokens: 2 },
    });
  });

  it("defaults to the claude-opus-5 model per ADR-0003", async () => {
    streamMock.mockReturnValue(fakeStream([], { model: "claude-opus-5", text: "", inputTokens: 0, outputTokens: 0 }));
    const provider = new AnthropicProvider({ apiKey: "test-key" });
    await provider.generateReply([{ role: "user", content: "hi" }], () => {});

    expect(streamMock).toHaveBeenCalledWith(expect.objectContaining({ model: "claude-opus-5" }));
  });

  it("wraps a failed request in an UpstreamError rather than leaking the raw SDK error", async () => {
    streamMock.mockImplementation(() => {
      throw new Error("network down");
    });
    const provider = new AnthropicProvider({ apiKey: "test-key" });

    await expect(provider.generateReply([{ role: "user", content: "hi" }], () => {})).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });
});
