import type { ReactNode } from "react";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
}

export function MessageBubble({ role, children }: MessageBubbleProps): ReactNode {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "75%",
          padding: "var(--omnira-space-3) var(--omnira-space-4)",
          borderRadius: 12,
          background: isUser ? "var(--omnira-accent)" : "var(--omnira-surface)",
          color: isUser ? "var(--omnira-accent-contrast)" : "var(--omnira-text-primary)",
          border: isUser ? "none" : "1px solid var(--omnira-border)",
          fontFamily: "var(--omnira-font-sans)",
          fontSize: "var(--omnira-text-base)",
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </div>
    </div>
  );
}
