import { Check } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentPersonaSummary } from "../api-client.js";

export interface AgentsPanelProps {
  agents: AgentPersonaSummary[];
  activeAgentId: string;
  onSelect: (id: string) => void;
}

/**
 * A real, honest slice of "multi-agent" — selectable behavioral personas
 * layered on the same single ChatAgent and model (see
 * packages/agents/src/chat-agent.ts's own doc comment: full autonomous
 * multi-agent planning/hand-off is explicitly out of scope for now). Picking
 * one genuinely changes the system prompt for your next message, verifiable
 * by the different reply style — not a fabricated "3 agents active" gauge.
 */
export function AgentsPanel({ agents, activeAgentId, onSelect }: AgentsPanelProps): ReactNode {
  if (agents.length === 0) {
    return (
      <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12px" }}>
        Couldn't load the agent list — check your connection and reopen this panel.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--omnira-space-2)" }}>
      <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
        One model, different behavior — picking a persona changes the instructions given to Omnira for every
        message you send from here on, until you switch again.
      </p>
      <div className="omnira-modal__conversation-list">
        {agents.map((agent) => {
          const active = agent.id === activeAgentId;
          return (
            <button
              key={agent.id}
              type="button"
              className="omnira-conversation-item"
              data-active={active}
              style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px" }}
              onClick={() => onSelect(agent.id)}
            >
              <span style={{ width: 16, flexShrink: 0, paddingTop: 2 }}>
                {active && <Check size={14} strokeWidth={2.5} color="var(--omnira-cyan)" />}
              </span>
              <span>
                <p style={{ margin: 0, color: "var(--omnira-text-primary)" }}>{agent.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--omnira-text-secondary)" }}>
                  {agent.description}
                </p>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
