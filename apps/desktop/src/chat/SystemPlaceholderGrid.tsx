import type { ReactNode } from "react";

export interface PlaceholderItem {
  icon: ReactNode;
  label: string;
}

/**
 * A compact grid of system/workspace facts this app doesn't have a real
 * data source for yet (CPU, GPU, RAM, running agents, calendar, etc.) —
 * the desktop shell has no OS-telemetry backend and no agents/automation
 * system today. Rendered honestly as "n/a" rather than inventing numbers:
 * this project's hard rule (see the real weather/news integrations) is
 * that nothing on screen fabricates data the app doesn't actually have.
 */
export function SystemPlaceholderGrid({ items }: { items: PlaceholderItem[] }): ReactNode {
  return (
    <div className="omnira-placeholder-grid">
      {items.map((item) => (
        <div key={item.label} className="omnira-placeholder-row">
          <span className="omnira-placeholder-row__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="omnira-placeholder-row__label">{item.label}</span>
          <span className="omnira-placeholder-row__value">n/a</span>
        </div>
      ))}
    </div>
  );
}
