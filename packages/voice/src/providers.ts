/**
 * Vendor-agnostic STT contract (ADR-0005) — apps/api talks only to this
 * interface, never to a vendor SDK directly. There is no server-side TTS
 * provider: per ADR-0005, spoken replies are synthesized client-side via
 * the browser's built-in `speechSynthesis`, which needs no vendor at all.
 */

export interface TranscriptionResult {
  text: string;
}

export interface SttProvider {
  readonly name: string;
  transcribe(audio: Buffer, mimeType: string): Promise<TranscriptionResult>;
}
