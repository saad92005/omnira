export interface AgentPersona {
  id: string;
  label: string;
  description: string;
  /** Layered on top of ChatAgent's base SYSTEM_PROMPT, never a replacement for it. */
  promptAddition: string;
}

/**
 * A small, honest slice of master prompt §5.1's "multi-agent roster" — not
 * autonomous planning/hand-off between agents (still one model, one
 * ChatAgent, explicitly deferred — see packages/agents/src/chat-agent.ts),
 * just a different behavioral framing layered on the same base system
 * prompt. Selectable per-conversation from the Agents dock panel.
 */
export const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: "general",
    label: "General",
    description: "The default, well-rounded assistant.",
    promptAddition: "",
  },
  {
    id: "coding",
    label: "Coding Helper",
    description: "More technical depth; code blocks are fine when the topic is code.",
    promptAddition:
      "Persona: Coding Helper. When the topic is code, you may use code blocks and precise technical terminology — the usual TTS-brevity rule is relaxed specifically for code content. Prefer correct, idiomatic solutions over the shortest possible answer.",
  },
  {
    id: "concise",
    label: "Concise",
    description: "As short as possible — answers only, no elaboration unless asked.",
    promptAddition:
      "Persona: Concise. Answer in as few words as possible — a single sentence or a short phrase whenever that fully answers the question. Never add unrequested context, caveats, or follow-up suggestions.",
  },
  {
    id: "coach",
    label: "Coach",
    description: "Encouraging and action-oriented — turns requests into concrete next steps.",
    promptAddition:
      "Persona: Coach. Be warm and encouraging. When it's useful, frame your answer as a concrete next step or small piece of actionable advice, and check in on progress toward whatever the user seems to be working on.",
  },
];

export const DEFAULT_AGENT_ID = "general";

export function resolvePersonaPrompt(agentId: string | undefined): string | undefined {
  const persona = AGENT_PERSONAS.find((p) => p.id === agentId);
  return persona?.promptAddition || undefined;
}
