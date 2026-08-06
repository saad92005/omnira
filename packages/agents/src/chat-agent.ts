import type { Logger } from "@omnira/core";
import { toOmniraError } from "@omnira/core";
import type { ModelProvider, TextDelta, ToolCallRequest, ToolDefinition } from "@omnira/orchestrator";
import { ConversationState } from "./conversation-state.js";
import { recordActivity } from "./activity-log.js";

export interface ChatTurnResult {
  reply: string;
}

/**
 * Omnira's persona and behavioral contract, prepended to every turn — not
 * stored as a ConversationTurn (ConversationState is pure message history,
 * §5.2), just injected here at call time. Two rules earn their place in a
 * system prompt this short: reply style must work when spoken aloud through
 * TTS (short, no markdown, plain confirmations), and language must mirror
 * the user rather than defaulting to English no matter what they write in.
 */
const SYSTEM_PROMPT = `You are Omnira, a capable personal AI assistant running on the user's own device — think Jarvis, not a generic chatbot. Be warm, direct, and competent.

Language: default to English, but if the user writes or speaks in Roman Urdu (Urdu written in Latin script, e.g. "aap kaisay hain") switch fluently to Roman Urdu and keep replying in whichever language they're using. Mirror their language choice turn by turn.

When you use a tool to take a real action (opening an app or URL, creating a file or folder, etc.), confirm what you actually did in one short, natural sentence once it succeeds, e.g. "I have made the file on your Desktop." or its Roman Urdu equivalent — never describe the tool call mechanically. If a tool fails, say so plainly and suggest what to try.

Keep replies concise and conversational — they are often read aloud by text-to-speech, not just displayed as text, so avoid markdown formatting, bullet lists, or anything that reads awkwardly out loud.`;

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
        [{ role: "system", content: SYSTEM_PROMPT }, ...state.toChatMessages()],
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
