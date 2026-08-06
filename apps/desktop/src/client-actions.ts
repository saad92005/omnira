import type { ClientAction } from "./api-client.js";

/**
 * Runs a follow-up effect the server asked the browser to perform (see
 * ClientAction in @omnira/agents for why this split exists — apps/api can't
 * wait-and-notify or touch the clipboard itself). Best-effort: a timer or
 * clipboard write failing is never worth surfacing as a chat error, since
 * the assistant's text reply already confirmed the action to the user.
 */
export async function runClientAction(action: ClientAction): Promise<void> {
  switch (action.type) {
    case "set_timer":
      return runTimer(action.payload);
    case "copy_to_clipboard":
      return runClipboardCopy(action.payload);
    default:
      // Unknown action types are ignored rather than thrown — a newer
      // server talking to an older client shouldn't break the chat turn
      // that triggered it.
      return undefined;
  }
}

async function runTimer(payload: Record<string, unknown>): Promise<void> {
  const seconds = Number(payload["seconds"]);
  const label = typeof payload["label"] === "string" ? payload["label"] : "";
  if (!Number.isFinite(seconds) || seconds <= 0) return;

  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission().catch(() => undefined);
  }

  setTimeout(() => {
    const title = label ? `Timer done: ${label}` : "Timer done";
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: "Omnira's timer just finished." });
    }
    // Notification permission denied/unsupported: the tab itself is the
    // fallback signal — no separate in-app toast system exists yet, and a
    // silently-missed timer is worse than a redundant document title flash.
    if (document.hidden) {
      const originalTitle = document.title;
      document.title = `⏰ ${title}`;
      const restore = (): void => {
        document.title = originalTitle;
        document.removeEventListener("visibilitychange", restore);
      };
      document.addEventListener("visibilitychange", restore);
    }
  }, seconds * 1000);
}

async function runClipboardCopy(payload: Record<string, unknown>): Promise<void> {
  const text = typeof payload["text"] === "string" ? payload["text"] : "";
  if (!text || !("clipboard" in navigator)) return;
  await navigator.clipboard.writeText(text).catch(() => undefined);
}
