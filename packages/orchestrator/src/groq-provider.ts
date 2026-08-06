import OpenAI from "openai";
import { UpstreamError } from "@omnira/core";
import type { ChatMessage, GenerateReplyResult, ModelProvider, TextDelta } from "./model-provider.js";

/**
 * Groq's chat-completions endpoint is OpenAI-compatible (base URL
 * `https://api.groq.com/openai/v1`), so the official `openai` SDK works
 * unmodified with a `baseURL` override — see ADR-0005. Free tier, no card
 * required, hosts open models (Llama, Gemma, etc.) rather than Claude.
 */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export interface GroqProviderOptions {
  apiKey: string;
  model?: string;
}

export class GroqProvider implements ModelProvider {
  readonly name = "groq";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: GroqProviderOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: GROQ_BASE_URL });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async generateReply(
    conversation: readonly ChatMessage[],
    onDelta: (delta: TextDelta) => void,
  ): Promise<GenerateReplyResult> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        stream: true,
        stream_options: { include_usage: true },
        messages: conversation.map((m) => ({ role: m.role, content: m.content })),
      });

      let text = "";
      let model = this.model;
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const chunk of stream) {
        model = chunk.model;
        const delta = chunk.choices[0]?.delta.content;
        if (delta) {
          text += delta;
          onDelta({ text: delta });
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens;
          outputTokens = chunk.usage.completion_tokens;
        }
      }

      return { text, model, usage: { inputTokens, outputTokens } };
    } catch (err) {
      throw new UpstreamError(`Groq API request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
