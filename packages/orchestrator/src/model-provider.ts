/**
 * Vendor-agnostic provider contract (ADR-0003). packages/agents talks only to
 * this interface, never to a vendor SDK directly, so a second provider can be
 * added later without touching agent code.
 */

export interface ChatMessage {
  role: "user" | "assistant";
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
}

export interface ModelProvider {
  readonly name: string;

  /**
   * Streams the assistant's reply to `conversation` (oldest message first).
   * `onDelta` is called for each text chunk as it arrives; the returned
   * promise resolves with the complete result once the stream ends.
   */
  generateReply(
    conversation: readonly ChatMessage[],
    onDelta: (delta: TextDelta) => void,
  ): Promise<GenerateReplyResult>;
}
