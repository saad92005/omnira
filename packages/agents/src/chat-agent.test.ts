import { describe, expect, it, vi } from "vitest";
import { UpstreamError, createRootLogger } from "@omnira/core";
import type { ModelProvider } from "@omnira/orchestrator";
import { ChatAgent } from "./chat-agent.js";
import { ConversationState } from "./conversation-state.js";

function silentLogger() {
  return createRootLogger({ level: "fatal", name: "test" });
}

describe("ChatAgent", () => {
  it("appends the user and assistant turns and returns the reply", async () => {
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async (_conversation, onDelta) => {
        onDelta({ text: "Hi" });
        return { text: "Hi", model: "fake-model", usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    };

    const agent = new ChatAgent(provider, silentLogger());
    const state = new ConversationState("user-1");
    const result = await agent.respond(state, "hello");

    expect(result.reply).toBe("Hi");
    expect(state.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("streams deltas to the caller as they arrive", async () => {
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async (_conversation, onDelta) => {
        onDelta({ text: "Hel" });
        onDelta({ text: "lo" });
        return { text: "Hello", model: "fake-model", usage: { inputTokens: 1, outputTokens: 2 } };
      }),
    };

    const agent = new ChatAgent(provider, silentLogger());
    const state = new ConversationState("user-1");
    const chunks: string[] = [];
    await agent.respond(state, "hi", (d) => chunks.push(d.text));

    expect(chunks).toEqual(["Hel", "lo"]);
  });

  it("records the user turn even when the provider fails, and rethrows as a typed error", async () => {
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async () => {
        throw new UpstreamError("model provider unreachable");
      }),
    };

    const agent = new ChatAgent(provider, silentLogger());
    const state = new ConversationState("user-1");

    await expect(agent.respond(state, "hello")).rejects.toBeInstanceOf(UpstreamError);
    // The user's message is still part of the record — a failed reply doesn't erase it.
    expect(state.turns).toHaveLength(1);
    expect(state.turns[0]?.role).toBe("user");
  });
});
