/**
 * TypeScript access to the tokens defined in tokens.css, for the rare case
 * that needs a value in JS rather than CSS (e.g. computing a chart color).
 * The CSS custom properties in tokens.css remain the source of truth for
 * anything rendered — don't hardcode a hex value here and expect it to
 * track a change to tokens.css; update both together.
 */
export const spacing = {
  1: "var(--omnira-space-1)",
  2: "var(--omnira-space-2)",
  3: "var(--omnira-space-3)",
  4: "var(--omnira-space-4)",
  6: "var(--omnira-space-6)",
  8: "var(--omnira-space-8)",
  12: "var(--omnira-space-12)",
} as const;

export const VoiceState = {
  Listening: "listening",
  Thinking: "thinking",
  Speaking: "speaking",
  AwaitingConfirmation: "awaiting_confirmation",
} as const;
export type VoiceState = (typeof VoiceState)[keyof typeof VoiceState];

export const VOICE_STATE_COLOR_TOKEN: Record<VoiceState, string> = {
  [VoiceState.Listening]: "var(--omnira-accent)",
  [VoiceState.Thinking]: "var(--omnira-text-secondary)",
  [VoiceState.Speaking]: "var(--omnira-success)",
  [VoiceState.AwaitingConfirmation]: "var(--omnira-warning)",
};
