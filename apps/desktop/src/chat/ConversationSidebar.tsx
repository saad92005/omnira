import type { ReactNode } from "react";
import { Button, useTilt3D } from "@omnira/ui-kit";
import type { ConversationSummary } from "../api-client.js";

export interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | undefined;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
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
        + New chat
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
    </aside>
  );
}
