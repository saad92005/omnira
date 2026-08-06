import type { Logger } from "@omnira/core";

/**
 * Every agent action is logged and human-readable (master prompt §3.3). This
 * is the one place that formats an agent turn for the user-visible activity
 * view — nothing else should hand-roll that string.
 */
export interface ActivityEntry {
  conversationId: string;
  userId: string;
  outcome: "success" | "failure";
  /** One human-readable sentence describing what happened. */
  summary: string;
  durationMs: number;
}

export function recordActivity(logger: Logger, entry: ActivityEntry): void {
  const level = entry.outcome === "success" ? "info" : "error";
  logger[level](
    {
      activity: true,
      conversationId: entry.conversationId,
      userId: entry.userId,
      outcome: entry.outcome,
      durationMs: entry.durationMs,
    },
    entry.summary,
  );
}
