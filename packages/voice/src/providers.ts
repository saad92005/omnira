/**
 * Vendor-agnostic STT/TTS contracts (ADR-0004), mirroring the
 * ModelProvider pattern in packages/orchestrator (ADR-0003) — apps/api talks
 * only to these interfaces, never to a vendor SDK directly.
 */

export interface TranscriptionResult {
  text: string;
}

export interface SttProvider {
  readonly name: string;
  transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult>;
}

export interface SpeechResult {
  audio: Buffer;
  mimeType: string;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(text: string): Promise<SpeechResult>;
}
