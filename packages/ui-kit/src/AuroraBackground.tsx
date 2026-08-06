import type { ReactNode } from "react";

/**
 * Fixed, full-viewport ambient background — two slowly drifting gradient
 * blobs (see .omnira-aurora-bg in tokens.css). Render exactly once, at the
 * app root, behind all content. Freezes under prefers-reduced-motion.
 */
export function AuroraBackground(): ReactNode {
  return (
    <div className="omnira-aurora-bg" aria-hidden="true">
      <div className="omnira-aurora-bg__accent" />
    </div>
  );
}
