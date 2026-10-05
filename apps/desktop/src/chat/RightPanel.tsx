import { Bot, BrainCircuit, Download, Globe, ListChecks, Mic2, ScrollText, ServerCog, Terminal, Zap } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { MessageBubble, TypingIndicator, WidgetCard, useTilt3D } from "@omnira/ui-kit";
import type { LogEntry } from "../hooks/useEventLog.js";
import { SystemPlaceholderGrid } from "./SystemPlaceholderGrid.js";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface RightPanelProps {
  messages: DisplayMessage[];
  sending: boolean;
  scrollAnchorRef: RefObject<HTMLDivElement>;
  onExportConversation: () => void;
  aiStatusLabel: string;
  currentCommand: string | null;
  apiReachable: boolean;
  online: boolean;
  micActive: boolean;
  logEntries: LogEntry[];
  activeAgentLabel: string;
}

const AGENT_PLACEHOLDERS = [
  { icon: <ListChecks size={12} strokeWidth={2} />, label: "Exec. queue" },
  { icon: <ServerCog size={12} strokeWidth={2} />, label: "Processes" },
  { icon: <Zap size={12} strokeWidth={2} />, label: "Tokens/sec" },
];

export function RightPanel({
  messages,
  sending,
  scrollAnchorRef,
  onExportConversation,
  aiStatusLabel,
  currentCommand,
  apiReachable,
  online,
  micActive,
  logEntries,
  activeAgentLabel,
}: RightPanelProps): ReactNode {
  const commLogTilt = useTilt3D<HTMLDivElement>(3);

  return (
    <div className="omnira-right-stack">
      <div
        ref={commLogTilt.ref}
        onPointerMove={commLogTilt.onPointerMove}
        onPointerLeave={commLogTilt.onPointerLeave}
        className="omnira-hud-commlog omnira-glass omnira-hud-panel omnira-tilt-3d"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p className="omnira-hud-label" style={{ margin: 0 }}>
            Comm log
          </p>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={onExportConversation}
              className="omnira-hud-label"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--omnira-cyan)", display: "inline-flex", alignItems: "center", gap: "4px" }}
              title="Download this conversation as a Markdown file"
            >
              <Download size={13} strokeWidth={2} /> Export
            </button>
          )}
        </div>
        {messages.length === 0 && !sending && (
          <p style={{ color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-sm)" }}>
            Say hello, or hold the core to talk.
          </p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role}>
            {m.text}
          </MessageBubble>
        ))}
        {sending && <TypingIndicator />}
        <div ref={scrollAnchorRef} />
      </div>

      <WidgetCard title="AI thinking" icon={<BrainCircuit size={13} strokeWidth={2} />} compact>
        <p style={{ margin: 0, fontFamily: "var(--omnira-font-heading)", fontSize: "var(--omnira-text-base)", fontWeight: 600 }}>
          {aiStatusLabel}
        </p>
        {currentCommand && (
          <p
            style={{
              margin: 0,
              color: "var(--omnira-text-secondary)",
              fontSize: "var(--omnira-text-xs)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={currentCommand}
          >
            &ldquo;{currentCommand}&rdquo;
          </p>
        )}
        <div className="omnira-status-row">
          <span className="omnira-hud-indicator" data-active={apiReachable}>
            <ServerCog size={11} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            System
          </span>
          <span className="omnira-hud-indicator" data-active={online}>
            <Globe size={11} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Internet
          </span>
          <span className="omnira-hud-indicator" data-active={micActive}>
            <Mic2 size={11} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Voice
          </span>
          <span className="omnira-hud-indicator" data-active="true">
            <Terminal size={11} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            Groq · GPT-OSS
          </span>
          <span className="omnira-hud-indicator" data-active="true" title="The active agent persona">
            <Bot size={11} strokeWidth={2} aria-hidden="true" />
            <span className="omnira-hud-indicator__dot" aria-hidden="true" />
            {activeAgentLabel}
          </span>
        </div>
      </WidgetCard>

      <WidgetCard title="Live log" icon={<ScrollText size={13} strokeWidth={2} />} compact>
        <div className="omnira-event-log" role="log">
          {logEntries.length === 0 && (
            <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "11px" }}>Nothing yet.</p>
          )}
          {logEntries
            .slice()
            .reverse()
            .map((entry) => (
              <p key={entry.id} className="omnira-event-log__line" data-kind={entry.kind}>
                <span className="omnira-event-log__time">{entry.time}</span> {entry.text}
              </p>
            ))}
        </div>
      </WidgetCard>

      <WidgetCard title="Execution" icon={<ListChecks size={13} strokeWidth={2} />} compact disconnected>
        <SystemPlaceholderGrid items={AGENT_PLACEHOLDERS} />
      </WidgetCard>
    </div>
  );
}
