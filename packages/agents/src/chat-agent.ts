import type { Logger } from "@omnira/core";
import { toOmniraError } from "@omnira/core";
import type { ModelProvider, TextDelta, ToolCallRequest, ToolDefinition } from "@omnira/orchestrator";
import { ConversationState } from "./conversation-state.js";
import { recordActivity } from "./activity-log.js";

export interface ChatTurnResult {
  reply: string;
}

/** A tool the agent can call, paired with the function that actually executes it. */
export interface ToolHandler {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * The single agent for Phase 0 (master prompt §5.1's full multi-agent roster
 * is out of scope until Phase 2). Holds no conversational state of its own
 * — that lives in the ConversationState passed to each call. Tools are
 * injected per-instance (apps/api wires up the concrete handlers, e.g.
 * system-control) so this package stays deployment-agnostic.
 */
export class ChatAgent {
  constructor(
    private readonly provider: ModelProvider,
    private readonly logger: Logger,
    private readonly tools: ToolHandler[] = [],
  ) {}

  async respond(
    state: ConversationState,
    userMessage: string,
    onDelta?: (delta: TextDelta) => void,
  ): Promise<ChatTurnResult> {
    state.addUserTurn(userMessage);
    const startedAt = Date.now();

    try {
      const result = await this.provider.generateReply(
        state.toChatMessages(),
        onDelta ?? (() => {}),
        this.tools.length > 0
          ? { tools: this.tools.map((t) => t.definition), executeTool: (call) => this.executeTool(call) }
          : undefined,
      );
      state.addAssistantTurn(result.text);

      const toolSummary = result.toolCallsMade?.length ? `, tools used: ${result.toolCallsMade.join(", ")}` : "";
      recordActivity(this.logger, {
        conversationId: state.id,
        userId: state.userId,
        outcome: "success",
        summary: `Replied to a message (${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens, model ${result.model}${toolSummary}).`,
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

  private async executeTool(call: ToolCallRequest): Promise<string> {
    const handler = this.tools.find((t) => t.definition.name === call.name);
    if (!handler) return `Error: no tool named "${call.name}" is available.`;
    return handler.execute(call.arguments);
  }
}
