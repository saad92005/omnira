import { useState, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { grantMicrophonePermission } from "../api-client.js";

// Kept in sync with packages/core/src/permissions.ts's CAPABILITY_DESCRIPTIONS by
// hand — @omnira/core itself is Node-only (config/logger use node:async_hooks,
// process.env) and isn't safe to bundle into the browser webview.
const MICROPHONE_DESCRIPTION =
  "Lets Omnira listen when you press and hold the voice hotkey, so you can talk to it instead of typing.";

export interface OnboardingProps {
  onComplete: () => void;
}

/**
 * First-run journey, reduced to Phase 0 scope (master prompt §3.1 journey 1):
 * explicit, plain-language permission grant before any voice feature is
 * reachable. Skipping is a real, supported choice — text chat still works
 * with no capability granted (§3.3: permissions are never implied).
 */
export function Onboarding({ onComplete }: OnboardingProps): ReactNode {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGrant(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await grantMicrophonePermission();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that choice. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--omnira-space-4)",
        maxWidth: 420,
        margin: "var(--omnira-space-12) auto",
        padding: "var(--omnira-space-6)",
        background: "var(--omnira-surface)",
        border: "1px solid var(--omnira-border)",
        borderRadius: 12,
        fontFamily: "var(--omnira-font-sans)",
        color: "var(--omnira-text-primary)",
      }}
    >
      <h1 style={{ fontSize: "var(--omnira-text-xl)", margin: 0 }}>Welcome to Omnira</h1>
      <p style={{ fontSize: "var(--omnira-text-base)", color: "var(--omnira-text-secondary)", margin: 0 }}>
        Before you start, decide whether Omnira can use your microphone. You can change this at any
        time in settings.
      </p>
      <div
        style={{
          padding: "var(--omnira-space-3)",
          border: "1px solid var(--omnira-border)",
          borderRadius: 8,
          fontSize: "var(--omnira-text-sm)",
        }}
      >
        <strong>Microphone</strong>
        <p style={{ margin: "var(--omnira-space-1) 0 0" }}>{MICROPHONE_DESCRIPTION}</p>
      </div>
      {error && (
        <p role="alert" style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: "var(--omnira-space-2)", justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onComplete} disabled={busy}>
          Not now
        </Button>
        <Button variant="primary" onClick={handleGrant} disabled={busy}>
          Allow microphone
        </Button>
      </div>
    </div>
  );
}
