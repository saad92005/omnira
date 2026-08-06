import type { ReactNode } from "react";

/** Shown in place of the assistant's next message while a reply is in flight. */
export function TypingIndicator(): ReactNode {
  return (
    <div className="omnira-bubble-row omnira-bubble-row--assistant omnira-fade-in-up">
      <div className="omnira-bubble omnira-bubble--assistant" aria-label="Omnira is typing" role="status">
        <span className="omnira-typing">
          <span className="omnira-typing__dot" />
          <span className="omnira-typing__dot" />
          <span className="omnira-typing__dot" />
        </span>
      </div>
    </div>
  );
}
