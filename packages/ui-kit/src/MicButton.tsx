import { Mic } from "lucide-react";
import type { PointerEvent, ReactNode } from "react";
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

  // Pointer capture keeps the press "attached" to this button even if the
  // cursor/finger drifts off its (fairly small) bounds mid-hold — without
  // it, a plain onPointerLeave cut recordings short constantly, since the
  // orb is a circle and any movement near its edge left the hit area.
  // Capture guarantees onPointerUp still fires here on release, wherever
  // that happens; onPointerCancel is the fallback for the cases even
  // capture can't cover (an OS gesture interrupting, losing the pointer).
  function handlePressStart(event: PointerEvent<HTMLButtonElement>): void {
    // Feature-detected, not just try/catch'd: jsdom (unit tests) doesn't
    // implement the Pointer Capture API at all, and it costs nothing to be
    // defensive about a real but less-common webview lacking it too.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onPressStart();
  }
  function handlePressEnd(event: PointerEvent<HTMLButtonElement>): void {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onPressEnd();
  }

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
      onPointerDown={disabled ? undefined : handlePressStart}
      onPointerUp={disabled ? undefined : handlePressEnd}
      onPointerCancel={disabled ? undefined : handlePressEnd}
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
        {size === "lg" && <span className="omnira-orb__scan" aria-hidden="true" />}
        <Mic size={iconSize} strokeWidth={1.8} />
      </span>
    </button>
  );
}
