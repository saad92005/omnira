import { useMemo, type ReactNode } from "react";

interface Particle {
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  hue: "" | "omnira-particle--magenta" | "omnira-particle--purple";
}

/** Mostly cyan with occasional magenta/purple accents — variety without losing the primary color identity. */
function pickHue(): Particle["hue"] {
  const roll = Math.random();
  if (roll < 0.14) return "omnira-particle--magenta";
  if (roll < 0.26) return "omnira-particle--purple";
  return "";
}

/** Stable across re-renders (generated once via useMemo) so particles never jump position. */
function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      duration: 16 + Math.random() * 20,
      delay: Math.random() * -30,
      hue: pickHue(),
    });
  }
  return particles;
}

/**
 * Fixed, full-viewport ambient background — drifting mesh-gradient blobs, a
 * perspective grid, floating particles, a slow scanning light beam, and
 * occasional radar-style data pulses (see the omnira-aurora-bg,
 * omnira-mesh-grid, omnira-particle, omnira-scan-beam and omnira-data-pulse
 * rules in tokens.css). CSS-only — no canvas, no WebGL, no GIFs. Render
 * exactly once, at the app root, behind all content, so every screen (auth,
 * onboarding, chat) shares one "always alive" background rather than each
 * screen getting its own. Freezes under prefers-reduced-motion.
 */
export function AuroraBackground(): ReactNode {
  const particles = useMemo(() => generateParticles(34), []);

  return (
    <div className="omnira-aurora-bg" aria-hidden="true">
      <div className="omnira-aurora-bg__accent" />
      <div className="omnira-hud-grid" />
      <div className="omnira-scan-beam" />
      <div className="omnira-particle-field">
        {particles.map((p, i) => (
          <span
            key={i}
            className={`omnira-particle ${p.hue}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
      <span className="omnira-data-pulse omnira-data-pulse--a" />
      <span className="omnira-data-pulse omnira-data-pulse--b" />
    </div>
  );
}
