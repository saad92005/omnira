import type { ReactNode } from "react";

interface NervePath {
  d: string;
  secondary?: boolean;
  duration: number;
  delay: number;
}

// Coordinates are in a 1600x1000 viewBox roughly matching the desktop grid
// (sidebar left, AI core center, comm log/right panel right, topbar top,
// dock bottom) — decorative and approximate, not pixel-anchored to real
// widget edges, so it doesn't need JS measurement/resize tracking to stay
// convincing. Hidden below the 1100px breakpoint where that spatial layout
// collapses to a single column (see the media query in tokens.css).
const PATHS: NervePath[] = [
  { d: "M800,500 C 620,470 400,440 40,390", duration: 3.2, delay: 0 },
  { d: "M800,500 C 980,470 1220,450 1560,410", duration: 3.6, delay: 0.5 },
  { d: "M800,460 C 780,320 760,160 740,40", duration: 2.8, delay: 1 },
  { d: "M800,540 C 830,700 860,860 830,960", duration: 3.4, delay: 1.6 },
  { d: "M800,460 C 640,340 420,220 180,110", secondary: true, duration: 4.2, delay: 0.3 },
  { d: "M800,540 C 980,660 1180,800 1420,920", secondary: true, duration: 4.6, delay: 2 },
];

/**
 * Thin animated "nerve" tendrils fanning out from the AI core toward the
 * surrounding panels, each carrying a small traveling glow — reads as the
 * core's energy reaching the rest of the interface rather than the panels
 * being unrelated boxes. Pure SVG + CSS (stroke-dashoffset flow +
 * animateMotion), no canvas/WebGL. Render once behind the HUD shell's
 * panels (first child, so DOM order puts it visually underneath them).
 */
export function NerveField(): ReactNode {
  return (
    <svg className="omnira-nerve-field" viewBox="0 0 1600 1000" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="omnira-nerve-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--omnira-cyan)" }} />
          <stop offset="55%" style={{ stopColor: "var(--omnira-blue)" }} />
          <stop offset="100%" style={{ stopColor: "var(--omnira-magenta)" }} />
        </linearGradient>
        <filter id="omnira-nerve-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {PATHS.map((p, i) => (
        <g key={i}>
          <path
            d={p.d}
            className={`omnira-nerve-path${p.secondary ? " omnira-nerve-path--secondary" : ""}`}
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: `${p.delay}s` }}
          />
          <circle r={p.secondary ? 3 : 4.5} className="omnira-nerve-pulse" filter="url(#omnira-nerve-glow)">
            <animateMotion dur={`${p.duration}s`} begin={`${p.delay}s`} repeatCount="indefinite" path={p.d} />
          </circle>
        </g>
      ))}
    </svg>
  );
}
