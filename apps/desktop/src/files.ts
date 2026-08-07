import { isTauri } from "@tauri-apps/api/core";
import { desktopDir, documentDir, downloadDir, homeDir, join } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";

/**
 * True only inside the actual Tauri desktop shell — a plain browser has no
 * filesystem access at all (by design, not a limitation of this code), so
 * the Files panel must detect this and show an honest message on the web
 * build instead of trying (and failing) to call these.
 */
export function isDesktopRuntime(): boolean {
  return isTauri();
}

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

export interface FilesRoot {
  id: string;
  label: string;
}

export const FILES_ROOTS: FilesRoot[] = [
  { id: "desktop", label: "Desktop" },
  { id: "documents", label: "Documents" },
  { id: "downloads", label: "Downloads" },
  { id: "home", label: "Home" },
];

export async function getRootPath(rootId: string): Promise<string> {
  switch (rootId) {
    case "desktop":
      return desktopDir();
    case "documents":
      return documentDir();
    case "downloads":
      return downloadDir();
    case "home":
      return homeDir();
    default:
      throw new Error(`Unknown root: ${rootId}`);
  }
}

export async function joinPath(base: string, name: string): Promise<string> {
  return join(base, name);
}

/** Directories first, then files, both alphabetical — real entries only, nothing invented. */
export async function listDirectory(path: string): Promise<FileEntry[]> {
  const entries = await readDir(path);
  return entries
    .map((e) => ({ name: e.name ?? "", isDirectory: e.isDirectory }))
    .filter((e) => e.name.length > 0)
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Opens a file or folder with the OS's default handler (Explorer, associated app, etc.). */
export async function openEntry(path: string): Promise<void> {
  await openPath(path);
}
