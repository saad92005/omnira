import { Play } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DIAGNOSTIC_COMMANDS, isDesktopRuntime, runDiagnostic } from "../terminal.js";

interface RunEntry {
  id: string;
  label: string;
  output: string;
  code: number | null;
  failed: boolean;
}

/**
 * A real terminal panel, deliberately scoped to a fixed set of read-only
 * diagnostic commands (whoami, ipconfig, tasklist, etc.) rather than
 * free-text/arbitrary shell access — each button below maps to exactly one
 * capability-scoped command with no user-supplied arguments at all (see
 * src-tauri/capabilities/default.json). Same allowlist-over-arbitrary-exec
 * principle as the existing System Control permission.
 */
export function TerminalPanel(): ReactNode {
  const [history, setHistory] = useState<RunEntry[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  if (!isDesktopRuntime()) {
    return (
      <p style={{ margin: 0 }}>
        The terminal needs the actual Omnira desktop app — a browser can't run local commands at all, by design.
        Install the Windows app to use this.
      </p>
    );
  }

  async function run(id: string, label: string): Promise<void> {
    setRunning(id);
    try {
      const result = await runDiagnostic(id);
      const output = (result.stdout || result.stderr || "(no output)").trimEnd();
      setHistory((prev) => [...prev, { id, label, output, code: result.code, failed: result.code !== 0 }]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        { id, label, output: err instanceof Error ? err.message : "Command failed to run.", code: null, failed: true },
      ]);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {DIAGNOSTIC_COMMANDS.map((cmd) => (
          <button
            key={cmd.id}
            type="button"
            className="omnira-chip"
            title={cmd.description}
            disabled={running !== null}
            onClick={() => void run(cmd.id, cmd.label)}
          >
            <Play size={10} strokeWidth={2} />
            {running === cmd.id ? "…" : cmd.label}
          </button>
        ))}
      </div>

      <div
        style={{
          fontFamily: "var(--omnira-font-mono)",
          fontSize: "11px",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid var(--omnira-glass-border)",
          borderRadius: "var(--omnira-radius-sm)",
          padding: "var(--omnira-space-2)",
          maxHeight: 260,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--omnira-space-2)",
        }}
      >
        {history.length === 0 && (
          <p style={{ margin: 0, color: "var(--omnira-text-secondary)" }}>Pick a command above to run it.</p>
        )}
        {history.map((entry, i) => (
          <div key={i}>
            <p style={{ margin: "0 0 2px", color: "var(--omnira-cyan)" }}>&gt; {entry.label}</p>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: entry.failed ? "var(--omnira-danger)" : "var(--omnira-text-secondary)",
              }}
            >
              {entry.output}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
