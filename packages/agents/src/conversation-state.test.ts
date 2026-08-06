import { describe, expect, it } from "vitest";
import { ConversationState } from "./conversation-state.js";

describe("ConversationState", () => {
  it("records turns in order and exposes them as read-only", () => {
    const state = new ConversationState("user-1");
    state.addUserTurn("hello");
    state.addAssistantTurn("hi there");

    expect(state.turns.map((t) => [t.role, t.content])).toEqual([
      ["user", "hello"],
      ["assistant", "hi there"],
    ]);
  });

  it("projects turns into provider-shaped chat messages, dropping metadata", () => {
    const state = new ConversationState("user-1");
    state.addUserTurn("hello");
    state.addAssistantTurn("hi there");

    expect(state.toChatMessages()).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
    ]);
  });

  it("gives each conversation a stable, unique id", () => {
    const a = new ConversationState("user-1");
    const b = new ConversationState("user-1");
    expect(a.id).not.toBe(b.id);
  });
});
