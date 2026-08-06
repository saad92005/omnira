import type { ReactNode } from "react";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
}

export function MessageBubble({ role, children }: MessageBubbleProps): ReactNode {
  return (
    <div className={`omnira-bubble-row omnira-bubble-row--${role} omnira-fade-in-up`}>
      <div className={`omnira-bubble omnira-bubble--${role}`}>{children}</div>
    </div>
  );
}
