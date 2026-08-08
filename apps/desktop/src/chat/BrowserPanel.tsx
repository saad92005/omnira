import { ExternalLink, Globe } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { isDesktopRuntime, openInBrowser } from "../browser.js";

const QUICK_LINKS = [
  { label: "Google", url: "https://www.google.com" },
  { label: "Wikipedia", url: "https://www.wikipedia.org" },
  { label: "GitHub", url: "https://github.com" },
  { label: "YouTube", url: "https://www.youtube.com" },
];

/**
 * A real browser — opening a link here spawns a genuine, separate native
 * webview window (the OS's own web engine, full navigation), not an
 * iframe or a static preview. Only available inside the actual Tauri
 * desktop shell.
 */
export function BrowserPanel(): ReactNode {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDesktopRuntime()) {
    return (
      <p style={{ margin: 0 }}>
        The browser needs the actual Omnira desktop app — a web page can't open a real native browser window from
        inside itself. Install the Windows app to use this.
      </p>
    );
  }

  async function open(target: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await openInBrowser(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the browser.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const target = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    void open(target);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
        Opens a real, separate browser window — the OS's own web engine, full navigation, not a preview.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "var(--omnira-space-2)" }}>
        <input
          className="omnira-input"
          style={{ flex: 1 }}
          placeholder="example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ExternalLink size={14} strokeWidth={2} /> Open
          </span>
        </Button>
      </form>
      {error && (
        <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {QUICK_LINKS.map((link) => (
          <button
            key={link.url}
            type="button"
            className="omnira-chip"
            disabled={busy}
            onClick={() => void open(link.url)}
          >
            <Globe size={11} strokeWidth={2} /> {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
