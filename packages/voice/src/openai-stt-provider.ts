import { UpstreamError } from "@omnira/core";
import type { SttProvider, TranscriptionResult } from "./providers.js";

const TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface OpenAiSttProviderOptions {
  apiKey: string;
  model?: string;
}

export class OpenAiSttProvider implements SttProvider {
  readonly name = "openai-whisper";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: OpenAiSttProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "whisper-1";
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
