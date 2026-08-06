import { MessageSquarePlus, Newspaper } from "lucide-react";
import type { ReactNode } from "react";
import { Button, useTilt3D } from "@omnira/ui-kit";
import type { ConversationSummary, NewsHeadline } from "../api-client.js";

export interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | undefined;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  headlines: NewsHeadline[];
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  headlines,
}: ConversationSidebarProps): ReactNode {
  const tilt = useTilt3D<HTMLElement>(3);

  return (
    <aside
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="omnira-glass omnira-hud-panel omnira-tilt-3d"
      style={{
        height: "100%",
        boxSizing: "border-box",
        padding: "var(--omnira-space-3)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--omnira-space-2)",
        overflowY: "auto",
      }}
    >
      <p className="omnira-hud-label" style={{ margin: "0 0 var(--omnira-space-1)" }}>
        Conversations
      </p>
      <Button variant="primary" onClick={onNewChat} fullWidth title="New chat (Ctrl/Cmd+Shift+K)">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <MessageSquarePlus size={15} strokeWidth={2} /> New chat
        </span>
      </Button>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-1)", marginTop: "var(--omnira-space-2)" }}>
        {conversations.length === 0 && (
          <p style={{ color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-sm)", padding: "var(--omnira-space-2)" }}>
            No conversations yet.
          </p>
        )}
        {conversations.map((c) => {
          const isActive = c.id === activeConversationId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={isActive}
              style={{
                textAlign: "left",
                padding: "var(--omnira-space-2) var(--omnira-space-3)",
                borderRadius: "var(--omnira-radius-sm)",
                border: "none",
                cursor: "pointer",
                background: isActive ? "var(--omnira-glass-border)" : "transparent",
                color: "var(--omnira-text-primary)",
                fontSize: "var(--omnira-text-sm)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "background var(--omnira-transition-fast)",
              }}
            >
              {c.title ?? "New conversation"}
            </button>
          );
        })}
      </div>

      {headlines.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-1)", marginTop: "auto", paddingTop: "var(--omnira-space-3)" }}>
          <p
            className="omnira-hud-label"
            style={{ margin: "0 0 var(--omnira-space-1)", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Newspaper size={13} strokeWidth={2} aria-hidden="true" /> Headlines
          </p>
          {headlines.map((headline) => (
            <a
              key={headline.link}
              href={headline.link}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "var(--omnira-space-1) var(--omnira-space-2)",
                borderRadius: "var(--omnira-radius-sm)",
                color: "var(--omnira-text-secondary)",
                fontSize: "var(--omnira-text-xs)",
                lineHeight: 1.4,
                textDecoration: "none",
                display: "block",
                transition: "color var(--omnira-transition-fast)",
              }}
            >
              {headline.title}
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}
