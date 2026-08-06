/**
 * Vendor-agnostic provider contract (ADR-0003). packages/agents talks only to
 * this interface, never to a vendor SDK directly, so a second provider can be
 * added later without touching agent code.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextDelta {
  text: string;
}

export interface GenerateReplyResult {
  /** Full assistant text, available once the stream completes. */
  text: string;
  /** Model identifier that actually served the request (for the activity log). */
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Tool calls the model actually made during this turn, for the activity log. */
  toolCallsMade?: string[];
}

/** A tool the model may call, in JSON-schema-parameters form (§5.4 — every tool is typed). */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface GenerateReplyOptions {
  tools?: ToolDefinition[];
  /** Invoked once per tool call the model makes; returns the tool's result as text. */
  executeTool?: (call: ToolCallRequest) => Promise<string>;
}

export interface ModelProvider {
  readonly name: string;

  /**
   * Streams the assistant's reply to `conversation` (oldest message first).
   * `onDelta` is called for each text chunk as it arrives; the returned
   * promise resolves with the complete result once the stream ends.
   *
   * When `options.tools` is set, the provider may run a tool round-trip
   * (call model → executeTool → call model again) before producing the
   * final text — that intermediate exchange is never persisted by the
   * caller, only the final reply, per ADR-0006's scoping.
   */
  generateReply(
    conversation: readonly ChatMessage[],
    onDelta: (delta: TextDelta) => void,
    options?: GenerateReplyOptions,
  ): Promise<GenerateReplyResult>;
}
