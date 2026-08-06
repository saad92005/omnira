import { afterEach, describe, expect, it, vi } from "vitest";
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

// createMock is a module-scoped shared mock — without resetting it, an
// earlier test's mockResolvedValueOnce()/mockRejectedValue() queue leaks
// into later tests and desyncs their expected call sequence.
afterEach(() => {
  createMock.mockReset();
});

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

  describe("tool calling", () => {
    const tools = [{ name: "get_weather", description: "Get the weather", parameters: { type: "object" } }];

    it("executes a requested tool and feeds the result back for a final answer", async () => {
      createMock
        .mockResolvedValueOnce({
          model: "llama-3.3-70b-versatile",
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  { id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"Paris"}' } },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 5 },
        })
        .mockResolvedValueOnce({
          model: "llama-3.3-70b-versatile",
          choices: [{ message: { role: "assistant", content: "It's sunny in Paris." } }],
          usage: { prompt_tokens: 30, completion_tokens: 6 },
        });

      const executeTool = vi.fn().mockResolvedValue("sunny, 22C");
      const provider = new GroqProvider({ apiKey: "test-key" });
      const result = await provider.generateReply([{ role: "user", content: "weather in Paris?" }], () => {}, {
        tools,
        executeTool,
      });

      expect(executeTool).toHaveBeenCalledWith({ id: "call_1", name: "get_weather", arguments: { city: "Paris" } });
      expect(result.text).toBe("It's sunny in Paris.");
      expect(result.toolCallsMade).toEqual(["get_weather"]);
      expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 11 });
    });

    it("returns a tool-execution error to the model as the tool result rather than throwing", async () => {
      createMock
        .mockResolvedValueOnce({
          model: "llama-3.3-70b-versatile",
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [{ id: "call_1", type: "function", function: { name: "get_weather", arguments: "{}" } }],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 2 },
        })
        .mockResolvedValueOnce({
          model: "llama-3.3-70b-versatile",
          choices: [{ message: { role: "assistant", content: "Sorry, that tool failed." } }],
          usage: { prompt_tokens: 15, completion_tokens: 4 },
        });

      const executeTool = vi.fn().mockRejectedValue(new Error("service unavailable"));
      const provider = new GroqProvider({ apiKey: "test-key" });
      const result = await provider.generateReply([{ role: "user", content: "weather?" }], () => {}, {
        tools,
        executeTool,
      });

      expect(result.text).toBe("Sorry, that tool failed.");
      // Second call's messages must include the error as the tool result, not a thrown exception.
      const secondCallArgs = createMock.mock.calls[1]?.[0] as { messages: Array<{ role: string; content?: string }> };
      const toolResultMessage = secondCallArgs.messages.find((m) => m.role === "tool");
      expect(toolResultMessage?.content).toContain("service unavailable");
    });

    it("gives up after the maximum number of tool round-trips rather than looping forever", async () => {
      createMock.mockResolvedValue({
        model: "llama-3.3-70b-versatile",
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "call_x", type: "function", function: { name: "get_weather", arguments: "{}" } }],
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 1 },
      });

      const executeTool = vi.fn().mockResolvedValue("still not done");
      const provider = new GroqProvider({ apiKey: "test-key" });

      await expect(
        provider.generateReply([{ role: "user", content: "loop forever" }], () => {}, { tools, executeTool }),
      ).rejects.toBeInstanceOf(UpstreamError);
    });
  });
});
