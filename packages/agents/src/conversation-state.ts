import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@omnira/orchestrator";

/**
 * Explicit, inspectable conversation state (master prompt §5.2 — "never rely
 * on implicit state hidden inside a single long prompt"). This is the entire
 * memory of a chat session; nothing about the conversation exists outside it.
 */
export interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export class ConversationState {
  readonly id: string;
  readonly userId: string;
  private readonly _turns: ConversationTurn[] = [];

  constructor(userId: string, id: string = randomUUID()) {
    this.id = id;
    this.userId = userId;
  }

  get turns(): readonly ConversationTurn[] {
    return this._turns;
  }

  addUserTurn(content: string): ConversationTurn {
    return this.pushTurn("user", content);
  }

  addAssistantTurn(content: string): ConversationTurn {
    return this.pushTurn("assistant", content);
  }

  /** Projects the turn history into the shape the model provider expects. */
  toChatMessages(): ChatMessage[] {
    return this._turns.map((turn) => ({ role: turn.role, content: turn.content }));
  }

  private pushTurn(role: ConversationTurn["role"], content: string): ConversationTurn {
    const turn: ConversationTurn = { id: randomUUID(), role, content, createdAt: new Date() };
    this._turns.push(turn);
    return turn;
  }
}
