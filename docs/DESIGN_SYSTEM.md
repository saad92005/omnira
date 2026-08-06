# Omnira Design System — v0 (Phase 0)

Established before any screen is built, per master prompt §14. This is the
minimum viable token set for Phase 0's chat surface and onboarding screen —
expand it as Phase 1+ adds real screens (dashboard, knowledge graph,
marketplace), not by inventing new one-off values per screen.

Implementation: `packages/ui-kit/src/tokens.css` (CSS custom properties) +
`packages/ui-kit/src/tokens.ts` (typed TS access to the same values, for
places that need them in JS rather than CSS).

## Color Tokens

Two palettes (light/dark) driven by `prefers-color-scheme` and an explicit
`data-theme` override, never two parallel stylesheets — every component
reads the same custom-property names in both modes.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--omnira-bg` | App background | `#FAFAFA` | `#121212` |
| `--omnira-surface` | Card/panel background | `#FFFFFF` | `#1E1E1E` |
| `--omnira-surface-raised` | Elevated surface (modals, popovers) | `#FFFFFF` | `#262626` |
| `--omnira-border` | Default border | `#E2E2E2` | `#333333` |
| `--omnira-text-primary` | Primary text | `#18181B` | `#F4F4F5` |
| `--omnira-text-secondary` | Secondary/muted text | `#71717A` | `#A1A1AA` |
| `--omnira-accent` | Brand accent, primary actions | `#5B5BD6` | `#8080F0` |
| `--omnira-accent-contrast` | Text on `--omnira-accent` | `#FFFFFF` | `#0B0B10` |
| `--omnira-danger` | Destructive actions, errors | `#DC2626` | `#F87171` |
| `--omnira-success` | Success/confirmation | `#16A34A` | `#4ADE80` |
| `--omnira-warning` | Warnings, pending confirmation | `#D97706` | `#FBBF24` |

Contrast targets: body text against its background meets WCAG 2.1 AA
(4.5:1) in both modes — verify any new color pairing against that bar before
adding it, per §14.

## Typography Scale

System font stack (no custom font load in Phase 0 — revisit once brand
identity work happens):

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

## Spacing Scale

4px base unit, exponential up to the sizes a chat/onboarding UI actually
needs:

```
--omnira-space-1: 4px;
--omnira-space-2: 8px;
--omnira-space-3: 12px;
--omnira-space-4: 16px;
--omnira-space-6: 24px;
--omnira-space-8: 32px;
--omnira-space-12: 48px;
```

## Motion

- Default transition: `150ms ease-out` for hover/focus states.
- State transitions (voice UI listening → thinking → speaking, per §14):
  `200ms ease-in-out`, no bounce/spring — Omnira's voice affordances should
  read as calm, not playful.
- Respect `prefers-reduced-motion: reduce` — every animation in
  `packages/ui-kit` must have a reduced-motion fallback that is an instant
  state change, no exceptions.

## Voice UI State Machine (§14)

Four states, each with a distinct color + icon (never color alone, for
accessibility):

| State | Color token | Icon affordance |
|---|---|---|
| `listening` | `--omnira-accent` | Pulsing mic icon |
| `thinking` | `--omnira-text-secondary` | Animated ellipsis |
| `speaking` | `--omnira-success` | Waveform icon |
| `awaiting_confirmation` | `--omnira-warning` | Filled warning icon |

## Accessibility Baseline (§14)

- WCAG 2.1 AA minimum: contrast ratios above, visible focus rings using
  `--omnira-accent` at 2px, every interactive element reachable by keyboard,
  every icon-only control has an `aria-label`.
- `prefers-reduced-motion` respected everywhere (see Motion above).

## Icon Set

Phase 0 uses inline SVG icons for the handful of glyphs needed (mic,
send, close, warning). No icon library dependency yet — revisit once the
command palette and dashboard (Phase 1+) need a broader set.
