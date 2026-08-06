import type { ReactNode } from "react";

export interface MessageBubbleProps {
  role: "user" | "assistant";
  children: ReactNode;
}

export function MessageBubble({ role, children }: MessageBubbleProps): ReactNode {
  return (
    <div className={`omnira-bubble-row omnira-bubble-row--${role}`}>
      <div className={`omnira-bubble omnira-bubble--${role} omnira-bubble-in-3d`}>{children}</div>
    </div>
  );
}
