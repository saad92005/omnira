import { useCallback, useRef } from "react";

export interface VoiceRecorder {
  start: () => Promise<void>;
  /** Resolves with the recorded audio once the recorder has fully stopped. */
  stop: () => Promise<Blob>;
}

/**
 * Preference order, most-compatible-with-Groq-Whisper first. A hardcoded
 * "audio/webm" broke recording entirely on any browser that doesn't
 * support it — notably iOS Safari, which has no WebM support at all and
 * only records audio/mp4 (AAC). `MediaRecorder.isTypeSupported` lets each
 * browser actually record in a format it supports instead of throwing.
 */
const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Push-to-talk capture via the browser MediaRecorder API (available in the
 * Tauri webview). This is Phase 0's reduced-scope voice input — no wake
 * word, no streaming; see docs/features/phase-0-foundation.md §0.5.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];

    // undefined mimeType lets the browser pick its own default rather than
    // throwing — better than failing outright on a browser this candidate
    // list doesn't happen to cover.
    const mimeType = pickSupportedMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mimeTypeRef.current = mimeType ?? (recorder.mimeType || "audio/webm");
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start();
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current;
      if (!recorder) {
        reject(new Error("Recording was not started"));
        return;
      }
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        if (blob.size === 0) {
          reject(new Error("No audio was captured — try holding the core a little longer."));
          return;
        }
        resolve(blob);
      };
      // A recorder that's already inactive (e.g. a second stop() call, or
      // the stream ended unexpectedly) throws synchronously on .stop().
      try {
        recorder.stop();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }, []);

  return { start, stop };
}
