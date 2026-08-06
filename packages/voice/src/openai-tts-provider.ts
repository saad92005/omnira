import { UpstreamError } from "@omnira/core";
import type { SpeechResult, TtsProvider } from "./providers.js";

const SPEECH_URL = "https://api.openai.com/v1/audio/speech";

export interface OpenAiTtsProviderOptions {
  apiKey: string;
  model?: string;
  voice?: string;
}

export class OpenAiTtsProvider implements TtsProvider {
  readonly name = "openai-tts";

  private readonly apiKey: string;
  private readonly model: string;
  private readonly voice: string;

  constructor(options: OpenAiTtsProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "tts-1";
    this.voice = options.voice ?? "alloy";
  }

  async synthesize(text: string): Promise<SpeechResult> {
    let response: Response;
    try {
      response = await fetch(SPEECH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.model, voice: this.voice, input: text }),
      });
    } catch (err) {
      throw new UpstreamError(`Text-to-speech request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      throw new UpstreamError(`Text-to-speech request failed with status ${response.status}`, {
        status: response.status,
      });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    return { audio, mimeType: "audio/mpeg" };
  }
}
