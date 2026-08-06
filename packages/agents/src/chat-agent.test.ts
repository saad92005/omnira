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

  it("passes tool definitions to the provider and dispatches tool calls to the matching handler", async () => {
    let capturedExecuteTool: ((call: { id: string; name: string; arguments: Record<string, unknown> }) => Promise<string>) | undefined;
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async (_conversation, onDelta, options) => {
        capturedExecuteTool = options?.executeTool;
        const toolResult = await options?.executeTool?.({ id: "call_1", name: "open_url", arguments: { url: "https://x.com" } });
        onDelta({ text: `done: ${toolResult}` });
        return { text: `done: ${toolResult}`, model: "fake-model", usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    };

    const execute = vi.fn().mockResolvedValue("opened");
    const agent = new ChatAgent(provider, silentLogger(), [
      { definition: { name: "open_url", description: "Opens a URL", parameters: {} }, execute },
    ]);
    const state = new ConversationState("user-1");
    const result = await agent.respond(state, "open example.com");

    expect(provider.generateReply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ tools: [{ name: "open_url", description: "Opens a URL", parameters: {} }] }),
    );
    expect(execute).toHaveBeenCalledWith({ url: "https://x.com" });
    expect(result.reply).toBe("done: opened");
    expect(capturedExecuteTool).toBeDefined();
  });

  it("returns a clear error string (not a throw) when the model requests an unknown tool", async () => {
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async (_conversation, _onDelta, options) => {
        const toolResult = await options?.executeTool?.({ id: "call_1", name: "does_not_exist", arguments: {} });
        return { text: toolResult ?? "", model: "fake-model", usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    };

    const agent = new ChatAgent(provider, silentLogger(), [
      { definition: { name: "open_url", description: "Opens a URL", parameters: {} }, execute: vi.fn() },
    ]);
    const state = new ConversationState("user-1");
    const result = await agent.respond(state, "do something unsupported");

    expect(result.reply).toContain('no tool named "does_not_exist"');
  });

  it("prepends a system prompt ahead of the conversation history on every turn", async () => {
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async (_conversation, onDelta) => {
        onDelta({ text: "Hi" });
        return { text: "Hi", model: "fake-model", usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    };

    const agent = new ChatAgent(provider, silentLogger());
    const state = new ConversationState("user-1");
    await agent.respond(state, "hello");

    const [conversation] = vi.mocked(provider.generateReply).mock.calls[0] ?? [];
    expect(conversation?.[0]).toMatchObject({ role: "system" });
    expect(conversation?.[1]).toMatchObject({ role: "user", content: "hello" });
    // The system prompt itself is never persisted as a ConversationTurn.
    expect(state.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("omits the tools option entirely when no tools are configured (no tool round-trip attempted)", async () => {
    const provider: ModelProvider = {
      name: "fake",
      generateReply: vi.fn(async (_conversation, onDelta) => {
        onDelta({ text: "Hi" });
        return { text: "Hi", model: "fake-model", usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    };

    const agent = new ChatAgent(provider, silentLogger());
    const state = new ConversationState("user-1");
    await agent.respond(state, "hello");

    expect(provider.generateReply).toHaveBeenCalledWith(expect.anything(), expect.anything(), undefined);
  });
});
