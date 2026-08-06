import { UpstreamError } from "@omnira/core";
import type { SttProvider, TranscriptionResult } from "./providers.js";

/**
 * Groq's audio-transcription endpoint is OpenAI-compatible (same request
 * shape as OpenAI's Whisper endpoint: multipart `file` + `model`, JSON
 * `{ text }` response) — see ADR-0005. Free tier, no card required.
 * `whisper-large-v3-turbo` is used by default for its higher rate limit;
 * `whisper-large-v3` is available for higher accuracy if needed.
 */
const TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export interface GroqSttProviderOptions {
  apiKey: string;
  model?: string;
}

export class GroqSttProvider implements SttProvider {
  readonly name = "groq-whisper";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: GroqSttProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "whisper-large-v3-turbo";
  }

  async transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", new Blob([audio], { type: mimeType }), `utterance.${extensionFor(mimeType)}`);
    form.append("model", this.model);

    let response: Response;
    try {
      response = await fetch(TRANSCRIPTION_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (err) {
      throw new UpstreamError(
        `Speech-to-text request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      throw new UpstreamError(`Speech-to-text request failed with status ${response.status}`, {
        status: response.status,
      });
    }

    const body = (await response.json()) as { text?: string };
    if (typeof body.text !== "string") {
      throw new UpstreamError("Speech-to-text response was missing a transcript");
    }
    return { text: body.text };
  }
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
  };
  return map[mimeType] ?? "webm";
}
