import { openUrl } from "@tauri-apps/plugin-opener";
import { isSafeHttpUrl } from "./browser.js";

/**
 * Opens `url` in the OS's real default browser (not our Tauri WebviewWindow
 * — see browser.ts) via the opener plugin. Required for OAuth consent
 * screens: Google actively refuses to render its sign-in page inside an
 * embedded webview ("This browser or app may not be secure"), and handing
 * an OAuth login to any embedded surface is the wrong trust model regardless
 * — the user needs their own browser's address bar, autofill, and password
 * manager. Capability-scoped to exactly the provider domains that use it
 * (see src-tauri/capabilities/default.json's opener:allow-open-url grant).
 */
export async function openInSystemBrowser(url: string): Promise<void> {
  if (!isSafeHttpUrl(url)) {
    throw new Error("That doesn't look like a valid http(s) URL.");
  }
  await openUrl(url);
}
