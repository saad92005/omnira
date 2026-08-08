import { useEffect, useState, type ReactNode } from "react";
import { getAnalyticsSummary, type AnalyticsSummary } from "../api-client.js";

const SPARKLINE_HEIGHT = 36;

function formatCount(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

function StatTile({ label, value, children }: { label: string; value: string; children?: ReactNode }): ReactNode {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--omnira-space-1)",
        padding: "var(--omnira-space-3)",
        borderRadius: "var(--omnira-radius-sm)",
        border: "1px solid var(--omnira-glass-border)",
      }}
    >
      <p style={{ margin: 0, fontSize: "11px", color: "var(--omnira-text-secondary)" }}>{label}</p>
      <p style={{ margin: 0, fontSize: "22px", fontWeight: 600, color: "var(--omnira-text-primary)" }}>{value}</p>
      {children}
    </div>
  );
}

/** A 7-bar sparkline — de-emphasis for the trailing 6 days, full accent for today. */
function Sparkline({ data }: { data: AnalyticsSummary["messagesByDay"] }): ReactNode {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: SPARKLINE_HEIGHT, marginTop: "2px" }}>
      {data.map((d, i) => {
        const isToday = i === data.length - 1;
        const height = Math.max(3, Math.round((d.count / max) * SPARKLINE_HEIGHT));
        return (
          <div
            key={d.date}
            role="img"
            aria-label={`${dayLabel(d.date)}: ${d.count} ${d.count === 1 ? "message" : "messages"}`}
            title={`${dayLabel(d.date)}: ${d.count}`}
            style={{
              flex: 1,
              height,
              borderRadius: "3px 3px 0 0",
              background: "var(--omnira-accent)",
              opacity: isToday ? 1 : 0.35,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Real usage numbers from apps/api (GET /v1/analytics/summary) — this
 * user's own persisted conversation/message history, nothing fabricated.
 * Automations, terminal runs, agent-persona picks, and browser opens aren't
 * persisted server-side yet, so they're left out here rather than invented
 * — see ConversationsService.getUsageSummary for the exact query.
 */
export function AnalyticsPanel(): ReactNode {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalyticsSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load usage stats."));
  }, []);

  if (error) {
    return (
      <p role="alert" style={{ margin: 0, color: "var(--omnira-danger)", fontSize: "var(--omnira-text-xs)" }}>
        {error}
      </p>
    );
  }

  if (!summary) {
    return <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>Loading usage stats…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
        {summary.firstActivityAt
          ? `Real conversation history since ${new Date(summary.firstActivityAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`
          : "No conversations yet — send a message in Chat to start building real history here."}
      </p>
      <div style={{ display: "flex", gap: "var(--omnira-space-2)" }}>
        <StatTile label="Conversations" value={formatCount(summary.totalConversations)} />
        <StatTile label="Messages" value={formatCount(summary.totalMessages)} />
        <StatTile label="This week" value={formatCount(summary.messagesLast7Days)}>
          <Sparkline data={summary.messagesByDay} />
        </StatTile>
      </div>
    </div>
  );
}
