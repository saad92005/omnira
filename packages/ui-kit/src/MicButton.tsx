import type { ReactNode } from "react";
import { VoiceState } from "./tokens.js";

export interface MicButtonProps {
  state: VoiceState | "idle";
  disabled?: boolean;
  disabledReason?: string;
  /** "lg" renders the HUD centerpiece variant (bigger, segmented tick ring). Defaults to "sm". */
  size?: "sm" | "lg";
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
 * Push-to-talk mic control rendered as an animated orb — the ring's speed
 * and the glow's color both carry the state, in addition to the
 * aria-label/title, per the §14 accessibility baseline (never color alone).
 * See /docs/DESIGN_SYSTEM.md "Voice UI State Machine" for the state table.
 */
export function MicButton({
  state,
  disabled,
  disabledReason,
  size = "sm",
  onPressStart,
  onPressEnd,
}: MicButtonProps): ReactNode {
  const label = disabled ? (disabledReason ?? "Voice is unavailable") : STATE_LABEL[state];
  const iconSize = size === "lg" ? 40 : 18;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      data-state={state}
      data-size={size}
      data-disabled={disabled ? "true" : "false"}
      className="omnira-orb"
      onPointerDown={disabled ? undefined : onPressStart}
      onPointerUp={disabled ? undefined : onPressEnd}
      onPointerLeave={disabled ? undefined : onPressEnd}
    >
      {size === "lg" && (
        <>
          <span className="omnira-orb__ticks" aria-hidden="true" />
          <span className="omnira-orb__ring3d omnira-orb__ring3d--a" aria-hidden="true" />
          <span className="omnira-orb__ring3d omnira-orb__ring3d--b" aria-hidden="true" />
          <span className="omnira-orb__ring3d omnira-orb__ring3d--c" aria-hidden="true" />
        </>
      )}
      <span className="omnira-orb__glow" aria-hidden="true" />
      <span className="omnira-orb__ring" aria-hidden="true" />
      <span className="omnira-orb__ring omnira-orb__ring--inner" aria-hidden="true" />
      <span className="omnira-orb__core" aria-hidden="true">
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}
