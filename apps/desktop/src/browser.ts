import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isDesktopRuntime } from "./files.js";

export { isDesktopRuntime };

const BROWSER_LABEL = "omnira-browser";

/** Same validation the server-side open_url tool (apps/api/src/tools/system-control.ts) already applies — reject anything that isn't a well-formed http(s) URL. */
export function isSafeHttpUrl(input: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  // Belt-and-suspenders: reject characters a legitimate URL should never
  // contain unescaped, even though URL parsing already constrains this.
  return !/[&|;<>^%\s"']/u.test(input.replace(/%[0-9a-fA-F]{2}/gu, ""));
}

/**
 * Opens a real, separate native browser window (Tauri WebviewWindow, the
 * OS's actual WebView2/WebKit engine) pointed at `url` — full JS/CSS,
 * real navigation, not an iframe or a screenshot. Reuses one window: if
 * "omnira-browser" is already open, it's closed first (WebviewWindow has
 * no in-place navigate() in this Tauri version) so this always ends with
 * exactly one browser window showing the requested page.
 *
 * Security note: this window is deliberately NOT listed in
 * capabilities/default.json's `windows` — arbitrary third-party sites
 * render there with zero Tauri command access, the platform default-deny,
 * not an oversight.
 */
export async function openInBrowser(url: string): Promise<void> {
  if (!isSafeHttpUrl(url)) {
    throw new Error("That doesn't look like a valid http(s) URL.");
  }

  const existing = await WebviewWindow.getByLabel(BROWSER_LABEL);
  if (existing) await existing.close();

  const win = new WebviewWindow(BROWSER_LABEL, {
    url,
    title: "Omnira Browser",
    width: 1180,
    height: 780,
  });

  return new Promise((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (event) => {
      reject(new Error(typeof event.payload === "string" ? event.payload : "Could not open the browser window."));
    });
  });
}
