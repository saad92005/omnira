import type { ReactNode } from "react";
import { VOICE_STATE_COLOR_TOKEN, VoiceState } from "./tokens.js";

export interface MicButtonProps {
  state: VoiceState | "idle";
  disabled?: boolean;
  disabledReason?: string;
  /** Push-to-talk: caller starts capture on press, stops on release. */
  onPressStart: () => void;
  onPressEnd: () => void;
}

const STATE_LABEL: Record<VoiceState | "idle", string> = {
  idle: "Hold to talk to Omnira",
  [VoiceState.Listening]: "Listening — release to send",
  [VoiceState.Thinking]: "Omnira is thinking",
  [VoiceState.Speaking]: "Omnira is speaking",
  [VoiceState.AwaitingConfirmation]: "Omnira is waiting for your confirmation",
};

/**
 * Push-to-talk mic control with the four-state voice affordance from
 * /docs/DESIGN_SYSTEM.md — color alone never carries the state; the
 * aria-label and visible label always do too, per the §14 accessibility
 * baseline.
 */
export function MicButton({ state, disabled, disabledReason, onPressStart, onPressEnd }: MicButtonProps): ReactNode {
  const color = state === "idle" ? "var(--omnira-text-secondary)" : VOICE_STATE_COLOR_TOKEN[state];
  const label = disabled ? (disabledReason ?? "Voice is unavailable") : STATE_LABEL[state];

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={disabled ? undefined : onPressStart}
      onPointerUp={disabled ? undefined : onPressEnd}
      onPointerLeave={disabled ? undefined : onPressEnd}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: `2px solid ${disabled ? "var(--omnira-border)" : color}`,
        background: "var(--omnira-surface)",
        color: disabled ? "var(--omnira-text-secondary)" : color,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color var(--omnira-transition-state), color var(--omnira-transition-state)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M5 11a7 7 0 0 0 14 0M12 18v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
