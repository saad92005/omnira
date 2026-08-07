import { useEffect } from "react";

/**
 * Drives a callback at animation-frame rate with the real, current
 * microphone input level (0–1, RMS-ish average of the Web Audio frequency
 * data) while `stream` is non-null. Reports via a callback rather than
 * React state so the AI core can paint at 60fps by writing a CSS custom
 * property directly through a ref, instead of forcing a React re-render on
 * every frame. No stream (idle/thinking/speaking) — no-op, level never
 * fabricated when there is nothing real to measure.
 */
export function useMicLevelMeter(stream: MediaStream | null, onLevel: (level: number) => void): void {
  useEffect(() => {
    if (!stream) return undefined;

    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return undefined;

    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let frameId: number;

    function tick(): void {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (const value of data) sum += value;
      const average = sum / data.length / 255;
      onLevel(Math.min(1, average * 1.6));
      frameId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(frameId);
      source.disconnect();
      void audioContext.close();
    };
  }, [stream, onLevel]);
}
