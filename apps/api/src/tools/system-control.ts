import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize, sep } from "node:path";
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

/**
 * File/folder creation is scoped to two fixed, user-owned folders — never an
 * LLM-supplied path. This is the same allowlist discipline as ALLOWED_APPS:
 * the set of writable locations is fixed in code, not expanded by input.
 */
const SAFE_DIRS = {
  desktop: join(homedir(), "Desktop"),
  documents: join(homedir(), "Documents"),
} as const;

export type SafeDir = keyof typeof SAFE_DIRS;
export const SAFE_DIR_NAMES = Object.keys(SAFE_DIRS) as SafeDir[];

/** No path separators, traversal segments, or control characters — a bare file/folder name only. */
function isSafeEntryName(name: string): boolean {
  if (name === "" || name === "." || name === "..") return false;
  // eslint-disable-next-line no-control-regex -- deliberately excluding control chars from filenames
  return !/[\\/:*?"<>|\x00-\x1f]/u.test(name);
}

function resolveSafePath(location: string, entryName: string): string {
  if (!(location in SAFE_DIRS)) {
    throw new ForbiddenError(`Omnira can only create files or folders in: ${SAFE_DIR_NAMES.join(", ")}.`);
  }
  if (!isSafeEntryName(entryName)) {
    throw new ValidationError("That name isn't allowed — no path separators or special characters.");
  }
  const dir = SAFE_DIRS[location as SafeDir];
  const target = normalize(join(dir, entryName));
  // Belt-and-suspenders: the resolved path must still be a direct child of
  // the allowlisted directory, even though isSafeEntryName already rejects
  // traversal segments.
  if (!target.startsWith(normalize(dir) + sep)) {
    throw new ForbiddenError("That path escapes the allowed folder.");
  }
  return target;
}

export async function createFile(location: string, fileName: string, content: string): Promise<{ path: string }> {
  const path = resolveSafePath(location, fileName);
  await mkdir(SAFE_DIRS[location as SafeDir], { recursive: true });
  await writeFile(path, content, "utf8");
  return { path };
}

export async function createFolder(location: string, folderName: string): Promise<{ path: string }> {
  const path = resolveSafePath(location, folderName);
  await mkdir(path, { recursive: true });
  return { path };
}
