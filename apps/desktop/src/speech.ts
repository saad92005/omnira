/**
 * Client-side TTS via the browser's native `speechSynthesis` (ADR-0005) —
 * no vendor, no API key, no network call. Tauri's webview is Chromium-based
 * on Windows/Linux (WebView2/WebKitGTK) and ships this API.
 */
export function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Speech synthesis is not available in this webview"));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Speech synthesis failed: ${event.error}`));
    window.speechSynthesis.speak(utterance);
  });
}
