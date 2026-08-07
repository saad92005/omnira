import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { describeTrigger, type Automation, type AutomationTrigger } from "../automations.js";
import type { UseAutomationsResult } from "../hooks/useAutomations.js";

/**
 * A real automation is a scheduled chat message — Omnira runs it through
 * the same agent and tools (timers, clipboard, allow-listed apps/URLs) it
 * would use for anything you type yourself. Only fires while Omnira is
 * open; there's no background service, and this panel says so rather than
 * implying otherwise.
 */
export function AutomationsPanel({ automations, addAutomation, removeAutomation, toggleAutomation }: UseAutomationsResult): ReactNode {
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"once" | "interval">("interval");
  const [atLocal, setAtLocal] = useState("");
  const [everyMinutes, setEveryMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setError(null);
    if (!label.trim() || !message.trim()) {
      setError("Give it a name and a message to send.");
      return;
    }
    let trigger: AutomationTrigger;
    if (kind === "once") {
      if (!atLocal) {
        setError("Pick a date and time.");
        return;
      }
      const at = new Date(atLocal);
      if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        setError("Pick a time in the future.");
        return;
      }
      trigger = { type: "once", atISO: at.toISOString() };
    } else {
      if (!Number.isFinite(everyMinutes) || everyMinutes < 1) {
        setError("Interval must be at least 1 minute.");
        return;
      }
      trigger = { type: "interval", everyMinutes };
    }
    addAutomation(label.trim(), message.trim(), trigger);
    setLabel("");
    setMessage("");
    setAtLocal("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-3)" }}>
      <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
        Schedules a real message to Omnira — it runs through the normal chat pipeline, tools and all. Only fires
        while Omnira is open.
      </p>

      <div className="omnira-modal__conversation-list">
        {automations.length === 0 && (
          <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>No automations yet.</p>
        )}
        {automations.map((a: Automation) => (
          <div
            key={a.id}
            className="omnira-modal__row"
            style={{ borderTop: "1px solid var(--omnira-glass-border)", alignItems: "flex-start" }}
          >
            <div style={{ minWidth: 0 }}>
              <p className="omnira-modal__row-label" style={{ margin: 0, opacity: a.enabled ? 1 : 0.5 }}>
                {a.label}
              </p>
              <p className="omnira-modal__row-desc">{describeTrigger(a.trigger)}</p>
              <p className="omnira-modal__row-desc" style={{ fontStyle: "italic" }}>
                &ldquo;{a.message}&rdquo;
              </p>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <button type="button" className="omnira-chip" data-on={a.enabled} onClick={() => toggleAutomation(a.id)}>
                {a.enabled ? "On" : "Off"}
              </button>
              <button
                type="button"
                className="omnira-modal__close"
                title="Delete"
                onClick={() => removeAutomation(a.id)}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)", borderTop: "1px solid var(--omnira-glass-border)", paddingTop: "var(--omnira-space-2)" }}>
        <input
          className="omnira-input"
          placeholder="Name (e.g. Morning check-in)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="omnira-input"
          placeholder="Message to send (e.g. What's the weather?)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div style={{ display: "flex", gap: "6px" }}>
          <button type="button" className="omnira-chip" data-on={kind === "interval"} onClick={() => setKind("interval")}>
            Repeating
          </button>
          <button type="button" className="omnira-chip" data-on={kind === "once"} onClick={() => setKind("once")}>
            Once
          </button>
        </div>
        {kind === "interval" ? (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
            Every
            <input
              type="number"
              min={1}
              className="omnira-input"
              style={{ width: 70 }}
              value={everyMinutes}
              onChange={(e) => setEveryMinutes(Number(e.target.value))}
            />
            minutes
          </label>
        ) : (
          <input
            type="datetime-local"
            className="omnira-input"
            value={atLocal}
            onChange={(e) => setAtLocal(e.target.value)}
          />
        )}
        {error && (
          <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" fullWidth>
          Add automation
        </Button>
      </form>
    </div>
  );
}
