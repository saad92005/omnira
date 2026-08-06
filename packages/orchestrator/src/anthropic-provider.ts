import Anthropic from "@anthropic-ai/sdk";
import { UpstreamError } from "@omnira/core";
import type { ChatMessage, GenerateReplyResult, ModelProvider, TextDelta } from "./model-provider.js";

export interface AnthropicProviderOptions {
  apiKey: string;
  /** ADR-0003: default to claude-opus-5 unless the caller has a specific reason not to. */
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";

  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(options: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generateReply(
    conversation: readonly ChatMessage[],
    onDelta: (delta: TextDelta) => void,
  ): Promise<GenerateReplyResult> {
    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: conversation.map((m) => ({ role: m.role, content: m.content })),
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          onDelta({ text: event.delta.text });
        }
      }

      const final = await stream.finalMessage();
      const text = final.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        text,
        model: final.model,
        usage: {
          inputTokens: final.usage.input_tokens,
          outputTokens: final.usage.output_tokens,
        },
      };
    } catch (err) {
      throw new UpstreamError(
        `Anthropic API request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
