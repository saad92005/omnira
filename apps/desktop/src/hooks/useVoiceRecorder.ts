import { useCallback, useRef } from "react";

export interface VoiceRecorder {
  start: () => Promise<void>;
  /** Resolves with the recorded audio once the recorder has fully stopped. */
  stop: () => Promise<Blob>;
}

const MIME_TYPE = "audio/webm";

/**
 * Push-to-talk capture via the browser MediaRecorder API (available in the
 * Tauri webview). This is Phase 0's reduced-scope voice input — no wake
 * word, no streaming; see docs/features/phase-0-foundation.md §0.5.
 */
export function useVoiceRecorder(): VoiceRecorder {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });
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
        resolve(new Blob(chunksRef.current, { type: MIME_TYPE }));
      };
      recorder.stop();
    });
  }, []);

  return { start, stop };
}
