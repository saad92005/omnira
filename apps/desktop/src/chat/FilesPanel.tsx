import { ChevronLeft, File, Folder, FolderOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  FILES_ROOTS,
  getRootPath,
  isDesktopRuntime,
  joinPath,
  listDirectory,
  openEntry,
  type FileEntry,
} from "../files.js";

/**
 * A real, read-only local file browser — Desktop/Documents/Downloads/Home
 * only (see src-tauri/capabilities/default.json), opening a file or folder
 * hands off to the OS's own default app (Explorer, Notepad, etc.) rather
 * than rendering file contents itself. Only available inside the actual
 * Tauri desktop shell; a plain browser has no filesystem access at all.
 */
export function FilesPanel(): ReactNode {
  const [rootId, setRootId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPath = history[history.length - 1];

  useEffect(() => {
    if (!currentPath) return;
    setLoading(true);
    setError(null);
    listDirectory(currentPath)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not read that folder."))
      .finally(() => setLoading(false));
  }, [currentPath]);

  if (!isDesktopRuntime()) {
    return (
      <p style={{ margin: 0 }}>
        The file browser needs the actual Omnira desktop app — a browser has no filesystem access at all, by
        design. Install the Windows app to use this.
      </p>
    );
  }

  async function openRoot(id: string): Promise<void> {
    setRootId(id);
    setError(null);
    try {
      const path = await getRootPath(id);
      setHistory([path]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that folder.");
    }
  }

  async function openFolder(name: string): Promise<void> {
    if (!currentPath) return;
    try {
      const next = await joinPath(currentPath, name);
      setHistory((prev) => [...prev, next]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that folder.");
    }
  }

  function goBack(): void {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  async function handleOpenFile(name: string): Promise<void> {
    if (!currentPath) return;
    try {
      const path = await joinPath(currentPath, name);
      await openEntry(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that file.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <div style={{ display: "flex", gap: "var(--omnira-space-1)", flexWrap: "wrap" }}>
        {FILES_ROOTS.map((root) => (
          <button
            key={root.id}
            type="button"
            className="omnira-chip"
            data-on={root.id === rootId}
            onClick={() => void openRoot(root.id)}
          >
            {root.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--omnira-danger)", margin: 0, fontSize: "var(--omnira-text-xs)" }}>
          {error}
        </p>
      )}

      {currentPath && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={goBack}
              disabled={history.length <= 1}
              className="omnira-modal__close"
              title="Back"
              style={{ opacity: history.length <= 1 ? 0.35 : 1 }}
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <span
              title={currentPath}
              style={{
                fontFamily: "var(--omnira-font-mono)",
                fontSize: "11px",
                color: "var(--omnira-text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {currentPath}
            </span>
          </div>

          <div className="omnira-modal__conversation-list">
            {loading && <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>Loading…</p>}
            {!loading && entries.length === 0 && (
              <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>This folder is empty.</p>
            )}
            {!loading &&
              entries.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  className="omnira-conversation-item"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  onClick={() => void (entry.isDirectory ? openFolder(entry.name) : handleOpenFile(entry.name))}
                  title={entry.isDirectory ? "Open folder" : "Open with default app"}
                >
                  {entry.isDirectory ? (
                    <Folder size={14} strokeWidth={2} style={{ flexShrink: 0, color: "var(--omnira-cyan)" }} />
                  ) : (
                    <File size={14} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.7 }} />
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</span>
                </button>
              ))}
          </div>
        </>
      )}

      {!currentPath && !error && (
        <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-sm)" }}>
          <FolderOpen size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Pick a folder above to browse it.
        </p>
      )}
    </div>
  );
}
