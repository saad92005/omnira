import { spawn } from "node:child_process";
import { ForbiddenError, UpstreamError, ValidationError } from "@omnira/core";

/**
 * A deliberately narrow slice of the "app launching" capability from master
 * prompt §7 — opening a URL or a small allowlisted set of known
 * applications, never arbitrary command execution. This is a Phase 0
 * simplification: real desktop-bridge (§7's "single, auditable chokepoint"
 * in the Rust/Tauri layer, with per-action confirmation UX) is Phase 1
 * scope. Executing here, server-side via Node, is only defensible because
 * Phase 0's `apps/api` is local-first and runs on the user's own machine —
 * this must move into desktop-bridge before any remote/hosted deployment.
 *
 * Every function here is a hard security boundary: never interpolate a
 * caller-supplied (or LLM-supplied) string into a shell command string.
 */

const ALLOWED_APPS = {
  browser: { label: "the default web browser", command: () => startArgs("about:blank") },
  notepad: { label: "Notepad", command: (): [string, string[]] => ["notepad.exe", []] },
  calculator: { label: "Calculator", command: (): [string, string[]] => ["calc.exe", []] },
  file_explorer: { label: "File Explorer", command: (): [string, string[]] => ["explorer.exe", []] },
} as const;

export type AllowedApp = keyof typeof ALLOWED_APPS;
export const ALLOWED_APP_NAMES = Object.keys(ALLOWED_APPS) as AllowedApp[];

function startArgs(target: string): [string, string[]] {
  // "start" is a cmd.exe builtin, not a standalone executable — must be run
  // via cmd /c. The empty "" is the (required) window-title argument to
  // `start`, not part of the target.
  return ["cmd.exe", ["/c", "start", '""', target]];
}

/**
 * Rejects anything that isn't a well-formed http(s) URL, including stray
 * shell metacharacters that a valid URL wouldn't contain unescaped. This is
 * the only string in this module that can vary per call — validate hard.
 */
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

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: false, stdio: "ignore" });
    child.once("error", (err) => reject(new UpstreamError(`Could not launch ${command}: ${err.message}`)));
    // "start" returns immediately once it hands off to the shell — don't
    // wait for the launched app to exit, only for the spawn itself to succeed.
    child.once("spawn", () => resolve());
  });
}

export async function openUrl(url: string): Promise<void> {
  if (process.platform !== "win32") {
    throw new UpstreamError("Opening URLs is only implemented for Windows in Phase 0.");
  }
  if (!isSafeHttpUrl(url)) {
    throw new ValidationError("That doesn't look like a valid http(s) URL.");
  }
  const [command, args] = startArgs(url);
  await run(command, args);
}

export async function openApp(app: string): Promise<{ label: string }> {
  if (process.platform !== "win32") {
    throw new UpstreamError("Opening apps is only implemented for Windows in Phase 0.");
  }
  if (!(app in ALLOWED_APPS)) {
    throw new ForbiddenError(
      `"${app}" isn't an app Omnira is allowed to open. Allowed: ${ALLOWED_APP_NAMES.join(", ")}.`,
    );
  }
  const entry = ALLOWED_APPS[app as AllowedApp];
  const [command, args] = entry.command();
  await run(command, args);
  return { label: entry.label };
}
