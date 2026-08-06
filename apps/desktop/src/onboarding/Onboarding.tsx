import { useState, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import { grantMicrophonePermission, grantSystemControlPermission } from "../api-client.js";

// Kept in sync with packages/core/src/permissions.ts's CAPABILITY_DESCRIPTIONS by
// hand — @omnira/core itself is Node-only (config/logger use node:async_hooks,
// process.env) and isn't safe to bundle into the browser webview.
const MICROPHONE_DESCRIPTION =
  "Lets Omnira listen when you press and hold the voice hotkey, so you can talk to it instead of typing.";
const SYSTEM_CONTROL_DESCRIPTION =
  "Lets Omnira open websites and a small set of known apps (browser, notepad, calculator, file explorer) on your computer when you ask it to.";

export interface OnboardingProps {
  onComplete: () => void;
}

/**
 * First-run journey (master prompt §3.1 journey 1): explicit, plain-language
 * permission grants before any capability-gated feature is reachable. Each
 * permission is independently optional — skipping either is a real, supported
 * choice, and text chat always works with nothing granted (§3.3: permissions
 * are never implied).
 */
export function Onboarding({ onComplete }: OnboardingProps): ReactNode {
  const [micGranted, setMicGranted] = useState(false);
  const [systemControlGranted, setSystemControlGranted] = useState(false);
  const [busy, setBusy] = useState<"mic" | "system" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGrantMic(): Promise<void> {
    setBusy("mic");
    setError(null);
    try {
      await grantMicrophonePermission();
      setMicGranted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that choice. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGrantSystemControl(): Promise<void> {
    setBusy("system");
    setError(null);
    try {
      await grantSystemControlPermission();
      setSystemControlGranted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that choice. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--omnira-space-4)",
      }}
    >
      <div
        className="omnira-glass omnira-card omnira-fade-in-up"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--omnira-space-4)",
          width: "100%",
          maxWidth: 480,
          fontFamily: "var(--omnira-font-sans)",
          color: "var(--omnira-text-primary)",
        }}
      >
        <h1 className="omnira-gradient-text" style={{ fontSize: "var(--omnira-text-xl)", margin: 0, fontWeight: 700 }}>
          Welcome to Omnira
        </h1>
        <p style={{ fontSize: "var(--omnira-text-base)", color: "var(--omnira-text-secondary)", margin: 0 }}>
          Decide what Omnira can do before you start. Each of these is optional, and you can change
          your mind any time in settings — nothing here is required to chat with Omnira.
        </p>

        <PermissionRow
          title="Microphone"
          description={MICROPHONE_DESCRIPTION}
          granted={micGranted}
          busy={busy === "mic"}
          onGrant={() => void handleGrantMic()}
        />
        <PermissionRow
          title="System control"
          description={SYSTEM_CONTROL_DESCRIPTION}
          granted={systemControlGranted}
          busy={busy === "system"}
          onGrant={() => void handleGrantSystemControl()}
        />

        {error && (
          <p role="alert" style={{ color: "var(--omnira-danger)", fontSize: "var(--omnira-text-sm)", margin: 0 }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" onClick={onComplete} disabled={busy !== null}>
            {micGranted || systemControlGranted ? "Continue" : "Skip for now"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface PermissionRowProps {
  title: string;
  description: string;
  granted: boolean;
  busy: boolean;
  onGrant: () => void;
}

function PermissionRow({ title, description, granted, busy, onGrant }: PermissionRowProps): ReactNode {
  return (
    <div
      style={{
        padding: "var(--omnira-space-3)",
        border: "1px solid var(--omnira-glass-border)",
        borderRadius: "var(--omnira-radius-sm)",
        fontSize: "var(--omnira-text-sm)",
        display: "flex",
        alignItems: "center",
        gap: "var(--omnira-space-3)",
        justifyContent: "space-between",
      }}
    >
      <div>
        <strong>{title}</strong>
        <p style={{ margin: "var(--omnira-space-1) 0 0" }}>{description}</p>
      </div>
      <Button variant={granted ? "secondary" : "primary"} onClick={onGrant} disabled={granted || busy}>
        {granted ? "Allowed" : "Allow"}
      </Button>
    </div>
  );
}
