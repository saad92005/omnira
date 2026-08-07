export interface ModuleInfo {
  title: string;
  description: string;
  related?: string;
}

/**
 * Honest descriptions for dock icons with no real backend yet. Shown in a
 * ModulePanel instead of doing nothing — the icon is genuinely interactive
 * (opens something real: an explanation of current scope), it just isn't a
 * fabricated feature. `related` calls out an actual adjacent capability
 * where one exists, so the panel doesn't just say "no" — see
 * docs/PROJECT_INDEX.md for what's actually built.
 */
export const MODULE_INFO: Record<string, ModuleInfo> = {
  agents: {
    title: "Agents",
    description: "Omnira currently runs a single chat agent that handles every request directly, end to end.",
    related: "A multi-agent system — specialized agents that plan and hand off work to each other — isn't built yet.",
  },
  browser: {
    title: "Browser",
    description: "There's no embedded browser or web-browsing capability inside Omnira yet.",
    related: "With System Control permission granted, Omnira can open a URL in your default browser when you ask it to in chat.",
  },
  automation: {
    title: "Automation",
    description: "There's no workflow-automation or task-scheduling engine yet.",
    related: "Ask Omnira directly in chat — it can already set countdown timers and copy text to your clipboard as one-off actions.",
  },
  analytics: {
    title: "Analytics",
    description: "Omnira doesn't collect or display usage analytics yet.",
  },
  music: {
    title: "Music",
    description: "There's no music playback or streaming-service integration yet.",
  },
  calendar: {
    title: "Calendar",
    description: "Omnira isn't connected to a calendar yet — this needs a real calendar-account integration.",
  },
};
