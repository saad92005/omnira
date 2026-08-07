import type { ReactNode } from "react";
import { useTilt3D } from "./useTilt3D.js";

export interface WidgetCardProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Marks a widget whose data source doesn't exist yet — renders a dim
      "not connected" state instead of ever showing fabricated numbers. */
  disconnected?: boolean;
  compact?: boolean;
}

/**
 * The floating glass card used throughout both sidebars and the dashboard
 * area — cursor-tracked 3D tilt, a hover glow, and a shine sweep on hover.
 * `disconnected` is the honest-placeholder state for widgets whose backing
 * data (system telemetry, agents, automations, etc.) doesn't exist in this
 * app yet — see docs/PROJECT_INDEX.md; this project never fabricates values
 * to fill a pretty widget.
 */
export function WidgetCard({ title, icon, action, children, disconnected, compact }: WidgetCardProps): ReactNode {
  const tilt = useTilt3D<HTMLDivElement>(3);

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className={`omnira-widget omnira-glass omnira-tilt-3d${compact ? " omnira-widget--compact" : ""}${disconnected ? " omnira-widget--disconnected" : ""}`}
    >
      <div className="omnira-widget__header">
        {icon && <span className="omnira-widget__icon">{icon}</span>}
        <p className="omnira-widget__title">{title}</p>
        {disconnected ? (
          <span className="omnira-widget__status" title="No live data source connected yet">
            <span className="omnira-widget__status-dot" aria-hidden="true" />
            n/a
          </span>
        ) : (
          action && <span className="omnira-widget__action">{action}</span>
        )}
      </div>
      <div className="omnira-widget__body">{children}</div>
    </div>
  );
}
