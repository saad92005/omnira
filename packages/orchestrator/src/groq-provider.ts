import OpenAI from "openai";
import { UpstreamError } from "@omnira/core";
import type {
  ChatMessage,
  GenerateReplyOptions,
  GenerateReplyResult,
  ModelProvider,
  TextDelta,
  ToolCallRequest,
} from "./model-provider.js";

/**
 * Groq's chat-completions endpoint is OpenAI-compatible (base URL
 * `https://api.groq.com/openai/v1`), so the official `openai` SDK works
 * unmodified with a `baseURL` override — see ADR-0005. Free tier, no card
 * required, hosts open models (Llama, Gemma, etc.) rather than Claude.
 */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// Groq retired its hosted Llama 3.x models in 2026; gpt-oss-120b supports tool
// calling and is on the free tier. Override with GROQ_MODEL without a code change.
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_TOOL_ROUNDS = 3;

/**
 * Groq's own error code for "the model's constrained function-calling
 * generation didn't produce valid output for the given tools" — a real,
 * reproducible upstream failure (e.g. asking for something that doesn't
 * map to any available tool, like "open my pc"), not a bug in how tools
 * are declared here. The `code` check is the documented signal; the
 * message substring is a defensive fallback in case Groq ever omits it.
 */
function isToolUseFailure(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    if (err.code === "tool_use_failed") return true;
    if (err.status === 400 && err.message.includes("Failed to call a function")) return true;
  }
  return false;
}

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
    options?: GenerateReplyOptions,
  ): Promise<GenerateReplyResult> {
    try {
      if (options?.tools?.length) {
        return await this.generateWithTools(conversation, onDelta, options);
      }
      return await this.generateStreamed(conversation, onDelta);
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      throw new UpstreamError(`Groq API request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async generateStreamed(
    conversation: readonly ChatMessage[],
    onDelta: (delta: TextDelta) => void,
  ): Promise<GenerateReplyResult> {
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
  }

  /**
   * Tool round-trips use non-streaming calls (tool_calls arrive as complete
   * JSON, not worth reassembling from streamed fragments for Phase 0's
   * needs). Only the intermediate tool-decision/tool-result exchange is
   * non-streaming — see ADR-0006. The final text is delivered to `onDelta`
   * as one chunk once the loop ends, so callers don't need a separate path.
   */
  private async generateWithTools(
    conversation: readonly ChatMessage[],
    onDelta: (delta: TextDelta) => void,
    options: GenerateReplyOptions,
  ): Promise<GenerateReplyResult> {
    const tools: OpenAI.ChatCompletionTool[] = (options.tools ?? []).map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const messages: OpenAI.ChatCompletionMessageParam[] = conversation.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let model = this.model;
    let inputTokens = 0;
    let outputTokens = 0;
    const toolCallsMade: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response: OpenAI.ChatCompletion;
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools,
          tool_choice: "auto",
        });
      } catch (err) {
        if (!isToolUseFailure(err)) throw err;
        // Groq's constrained decoding for function-calling occasionally
        // fails outright for a given prompt/tool combination — a known
        // upstream limitation (their own error literally says "please
        // adjust your prompt"), not something retrying with the same
        // tools reliably fixes. Degrade to a plain answer for this turn
        // instead of surfacing that raw error to the user.
        const fallback = await this.client.chat.completions.create({ model: this.model, messages });
        const text = fallback.choices[0]?.message?.content ?? "";
        onDelta({ text });
        return {
          text,
          model: fallback.model,
          usage: {
            inputTokens: inputTokens + (fallback.usage?.prompt_tokens ?? 0),
            outputTokens: outputTokens + (fallback.usage?.completion_tokens ?? 0),
          },
          toolCallsMade,
        };
      }

      model = response.model;
      inputTokens += response.usage?.prompt_tokens ?? 0;
      outputTokens += response.usage?.completion_tokens ?? 0;

      const message = response.choices[0]?.message;
      const calls = message?.tool_calls;

      if (!message || !calls || calls.length === 0) {
        const text = message?.content ?? "";
        onDelta({ text });
        return { text, model, usage: { inputTokens, outputTokens }, toolCallsMade };
      }

      messages.push({ role: "assistant", content: message.content, tool_calls: calls });

      for (const call of calls) {
        const result = await this.runTool(call, options.executeTool);
        toolCallsMade.push(call.function.name);
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
    }

    throw new UpstreamError(`Exceeded the maximum of ${MAX_TOOL_ROUNDS} tool round-trips without a final answer.`);
  }

  private async runTool(
    call: OpenAI.ChatCompletionMessageToolCall,
    executeTool: GenerateReplyOptions["executeTool"],
  ): Promise<string> {
    if (!executeTool) return "Error: no tool executor is configured.";

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    } catch {
      return "Error: the tool call arguments were not valid JSON.";
    }

    const request: ToolCallRequest = { id: call.id, name: call.function.name, arguments: args };
    try {
      return await executeTool(request);
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
