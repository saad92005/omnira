import type { Logger } from "@omnira/core";
import { toOmniraError } from "@omnira/core";
import type { ModelProvider, TextDelta } from "@omnira/orchestrator";
import { ConversationState } from "./conversation-state.js";
import { recordActivity } from "./activity-log.js";

export interface ChatTurnResult {
  reply: string;
}

/**
 * The single agent for Phase 0 (master prompt §5.1's full multi-agent roster
 * is out of scope until Phase 2). Holds no state of its own beyond its
 * provider — all conversational memory lives in the ConversationState passed
 * to each call.
 */
export class ChatAgent {
  constructor(
    private readonly provider: ModelProvider,
    private readonly logger: Logger,
  ) {}

  async respond(
    state: ConversationState,
    userMessage: string,
    onDelta?: (delta: TextDelta) => void,
  ): Promise<ChatTurnResult> {
    state.addUserTurn(userMessage);
    const startedAt = Date.now();

    try {
      const result = await this.provider.generateReply(state.toChatMessages(), onDelta ?? (() => {}));
      state.addAssistantTurn(result.text);

      recordActivity(this.logger, {
        conversationId: state.id,
        userId: state.userId,
        outcome: "success",
        summary: `Replied to a message (${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens, model ${result.model}).`,
        durationMs: Date.now() - startedAt,
      });

      return { reply: result.text };
    } catch (err) {
      const omniraErr = toOmniraError(err);
      recordActivity(this.logger, {
        conversationId: state.id,
        userId: state.userId,
        outcome: "failure",
        summary: `Failed to reply: ${omniraErr.message}`,
        durationMs: Date.now() - startedAt,
      });
      throw omniraErr;
    }
  }
}
