# Omnira Design System — v1.2 "Aurora"

Established before any screen is built, per master prompt §14. v0 (Phase 0
walking skeleton) shipped a minimal functional token set; v1.1 layered a
real visual identity on top of the same tokens; v1.2 adds a 3D depth scale
(layered shadows, glossy orb shading, hover lift) on top of that — expanding,
not replacing, per §14's "one system, not two parallel stylesheets." Extend
it as Phase 1+ adds real screens (dashboard, knowledge graph, marketplace),
not by inventing new one-off values per screen.

Implementation: `packages/ui-kit/src/tokens.css` (CSS custom properties,
keyframes, and reusable component classes) + `packages/ui-kit/src/tokens.ts`
(typed TS access to the subset needed in JS, e.g. the `VoiceState` enum).

**Signature default is dark.** `apps/desktop` sets `data-theme="dark"` on
the root element regardless of OS preference — this is Omnira's identity,
the same way many AI-assistant products ship a dark-first signature look.
Light mode is fully implemented from the same tokens (not a stub) for
accessibility and any future theme toggle; nothing here forces dark mode on
other consumers of `packages/ui-kit`.

## Color Tokens

| Token | Role | Light | Dark |
|---|---|---|---|
| `--omnira-bg` | App background | `#FAFAFA` | `#05050A` |
| `--omnira-surface` | Card/panel background | `#FFFFFF` | `#1E1E1E` |
| `--omnira-surface-raised` | Elevated surface (modals, popovers) | `#FFFFFF` | `#262626` |
| `--omnira-border` | Default border | `#E2E2E2` | `#333333` |
| `--omnira-text-primary` | Primary text | `#18181B` | `#F4F4F5` |
| `--omnira-text-secondary` | Secondary/muted text | `#71717A` | `#A1A1AA` |
| `--omnira-accent` | Brand accent (violet), primary actions | `#5B5BD6` | `#8080F0` |
| `--omnira-accent-2` | Aurora secondary (cyan), gradient pairing | `#0891B2` | `#22D3EE` |
| `--omnira-accent-3` | Aurora tertiary (magenta), gradient accents | `#A21CAF` | `#E879F9` |
| `--omnira-accent-contrast` | Text on `--omnira-accent` | `#FFFFFF` | `#0B0B10` |
| `--omnira-danger` | Destructive actions, errors | `#DC2626` | `#F87171` |
| `--omnira-success` | Success/confirmation | `#16A34A` | `#4ADE80` |
| `--omnira-warning` | Warnings, pending confirmation | `#D97706` | `#FBBF24` |
| `--omnira-glass-bg` | Glass-panel fill | `rgba(255,255,255,.72)` | `rgba(255,255,255,.05)` |
| `--omnira-glass-border` | Glass-panel border | `rgba(24,24,27,.08)` | `rgba(255,255,255,.09)` |
| `--omnira-glow-accent` | Box-shadow value for accent glow on hover | violet, 25% | violet, 35% |

Contrast targets: body text against its background meets WCAG 2.1 AA
(4.5:1) in both modes — verify any new color pairing against that bar before
adding it, per §14. Glass panels are checked with text over the panel fill,
not the raw background, since that's what a user actually reads against.

## Typography Scale

System font stack (no custom font load — revisit once brand identity work
extends beyond this):

```
--omnira-font-sans: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--omnira-font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

| Token | Size | Line height | Use |
|---|---|---|---|
| `--omnira-text-xs` | 12px | 16px | Timestamps, metadata |
| `--omnira-text-sm` | 14px | 20px | Secondary UI text |
| `--omnira-text-base` | 15px | 22px | Body text, chat messages |
| `--omnira-text-lg` | 18px | 26px | Section headings |
| `--omnira-text-xl` | 24px | 32px | Screen titles |

## Spacing & Radius

4px base spacing unit, exponential up to the sizes a chat/onboarding UI
actually needs; two radius tokens (`--omnira-radius` 16px for panels/
bubbles, `--omnira-radius-sm` 10px for buttons/inputs) so rounding stays
consistent instead of ad hoc per component.

```
--omnira-space-1: 4px;  --omnira-space-2: 8px;  --omnira-space-3: 12px;
--omnira-space-4: 16px; --omnira-space-6: 24px; --omnira-space-8: 32px;
--omnira-space-12: 48px;
--omnira-radius: 16px;  --omnira-radius-sm: 10px;
```

## Motion

- Default transition: `150ms ease-out` for hover/focus states.
- State transitions (voice UI listening → thinking → speaking): `200ms
  ease-in-out`, no bounce/spring — Omnira's voice affordances read as calm
  intelligence, not playful bounce.
- **Ambient motion (Aurora background, orb rings, glow breathe) is slow and
  continuous** (18–34s per cycle for the background, 6–9s for orb rings) —
  it should register as "alive" in peripheral vision without ever
  demanding attention or distracting from the conversation.
- Message entrance: 320ms fade + translateY(10px→0), `ease-out`, no stagger
  beyond natural send/receive timing.
- Every animation in `packages/ui-kit` has a `prefers-reduced-motion:
  reduce` fallback that freezes to a static end state — no exceptions. This
  is enforced in one place (`tokens.css`'s final media query), not
  per-component, so a new animated class is reduced-motion-safe by default
  only if it's added to that block — remember to add it.

## Voice UI State Machine (§14)

Rendered as a single animated orb (`MicButton`, `.omnira-orb` classes) —
a conic-gradient ring plus an inner glow, both driven by `data-state`. Color
is never the only signal: each state also has a distinct `aria-label` and
visible text label, and the ring's motion characteristics differ (not just
its color).

| State | Ring | Glow | Motion |
|---|---|---|---|
| `idle` | Static, dim (35% opacity) | none | No animation — the resting state |
| `listening` | Full-speed spin | Accent-colored, breathing | Orb scales 1↔1.08 (`omnira-orb-pulse`) |
| `thinking` | Faster spin (1.4s/2.1s) | none | Conveys active processing |
| `speaking` | Normal spin | Success-colored, fast breathe (0.6s) | |
| `awaiting_confirmation` | Normal spin | Warning-colored, static | Never auto-dismisses |

## Glass Panels & Aurora Background

- `.omnira-glass` — the shared glassmorphism treatment (blurred
  translucent fill + hairline border) used for message bubbles (assistant
  side), cards, and the composer bar. Never used for the user's own message
  bubbles (those use the solid accent gradient, per contrast — translucent
  fill over a moving background risks failing the AA check for light text).
- `.omnira-aurora-bg` — a fixed, full-viewport background layer with two
  large blurred gradient blobs drifting slowly (`omnira-aurora-drift`).
  Rendered once at the app root, behind all content (`z-index: 0`), never
  per-screen — one instance, not a background-image trick repeated on every
  card.

## Elevation / 3D Depth (v1.2)

Three layered shadow tokens (`--omnira-shadow-1/2/3`, each a tight contact
shadow plus a soft diffuse one — never a single flat `box-shadow`) plus
`--omnira-inset-highlight` (a 1px top inner highlight that reads as a lit
bevel edge on glass panels and bubbles). Depth increases with a surface's
"nearness" to the user: buttons and bubbles sit at `--omnira-shadow-1`
(nudging to `--omnira-shadow-2` on hover/press), glass panels (sidebar,
composer, cards) sit at `--omnira-shadow-2` permanently. Interactive
elements lift on hover (`translateY(-1px)` to `-2px`) and settle on
press — depth responds to touch, it isn't just decoration.

The voice orb's core (`.omnira-orb__core`) uses a radial-gradient highlight
plus an inset shadow to read as a lit sphere rather than a flat disc — the
one deliberately more literal "3D" element, since it's the product's single
focal affordance.

## Accessibility Baseline (§14)

- WCAG 2.1 AA minimum: contrast ratios above, visible focus rings using
  `--omnira-accent` at 2px, every interactive element reachable by keyboard,
  every icon-only control has an `aria-label`.
- `prefers-reduced-motion` respected everywhere (see Motion above) — this
  includes the Aurora background and orb rings, which freeze rather than
  animate.
- Glass panels are checked for AA contrast with real text, not assumed safe
  because "it's just a background."

## Icon Set

Inline SVG for the handful of glyphs needed (mic → now the orb, send,
close, warning). No icon library dependency yet — revisit once the command
palette and dashboard (Phase 1+) need a broader set.
