# Phase 0: Foundation

- **Status:** Proposed — pending owner confirmation before implementation begins.
- **Master prompt reference:** §2.3 ("Core architecture, auth, permission model,
  basic voice loop, single-agent chat"), §17 (mandatory phased workflow).

## Goal

Stand up the smallest possible walking skeleton that proves the whole spine of
Omnira end to end — a user can install the desktop shell, grant a permission,
authenticate, and have a real (voice or text) conversation with a single agent that
logs its own activity — without pulling in anything from Phase 1+ (no file
intelligence, no multi-agent orchestration, no browser/automation, no billing).

## Explicit Non-Goals for Phase 0

- No wake-word detection or barge-in interruption (§6.1) — deferred to a later voice
  refinement phase. Phase 0 voice is push-to-talk (hotkey), non-streaming STT/TTS.
- No multi-agent planning (Planner/Researcher/Developer/etc., §5.1) — one agent only.
- No desktop-bridge OS capabilities beyond microphone access — file/app/clipboard/
  terminal control is Phase 1 (§7).
- No multi-tenancy, billing, or admin portal (§12) — single local user account.
- No browser automation, automation platform, or coding-assistant IDE integration.

Each of these is a real product requirement from the master prompt, deliberately
sequenced later — not dropped. They're tracked in PROJECT_INDEX.md's roadmap.

## Sub-Phases

### 0.1 — Monorepo Scaffold
**Deliverable:** pnpm workspace + Turborepo config; root `tsconfig.base.json`
(strict mode); shared ESLint/Prettier config; `/docs/CONVENTIONS.md` documenting the
TypeScript naming/style conventions; empty-but-wired packages matching §4.2
(`core`, `agents`, `orchestrator`, `desktop-bridge`, `voice`, `ui-kit`) and apps
(`desktop`, `api`).
**Acceptance criteria:**
- Given a fresh clone, when `pnpm install && pnpm build` runs, then all packages
  build with zero TypeScript errors.
- Given the lint config, when `pnpm lint` runs on a deliberately malformed file,
  then it fails with a clear rule violation.

### 0.2 — Core Package & Error Envelope
**Deliverable:** `packages/core` — shared types, environment-based config loader
(no secrets in source, `.env.example` kept current per §4.6), structured/leveled
logger with correlation-ID support, and the REST error envelope type
`{ error: { code, message, details, requestId } }` (§4.4).
**Acceptance criteria:**
- Given a missing required env var, when the config loader initializes, then it
  fails loudly with a specific error naming the missing var (§4.6 "fail loudly in
  development").
- Given two calls sharing a correlation ID, when both are logged, then both log
  lines carry that ID.

### 0.3 — Auth & Permission Model Foundation
**Deliverable:** `apps/api` REST service (`/v1`) with Postgres (via Prisma or
Drizzle — decision recorded in a follow-up ADR before this sub-phase starts) for
user accounts; OAuth2/OIDC-style auth with short-lived access tokens + refresh
rotation (§13); a `permissions` domain in `packages/core` modeling per-capability
grants (§7) as data — starting with exactly one real capability, `microphone` — so
the schema is exercised end-to-end without building unrelated capabilities early.
**Acceptance criteria:**
- Given valid credentials, when a user logs in, then they receive a short-lived
  access token and a rotating refresh token; given an expired access token, when a
  request is made, then it's rejected with a typed 401 in the standard error
  envelope.
- Given a granted `microphone` permission, when the user revokes it, then any
  subsequent voice-capable request is rejected immediately (§3.3 "revoke... halts
  related capabilities").
- Given every table with user data, when queried, then row-level ownership is
  enforced at the query layer (early rehearsal of the multi-tenant isolation model
  coming in Phase 5, §12).

### 0.4 — Single-Agent Chat
**Deliverable:** `packages/agents` with one agent (no Planner/Researcher split yet)
that holds an explicit, inspectable conversation state object (§5.2 — not a hidden
long prompt) and calls out to a model via a typed provider interface in
`packages/orchestrator` (routing rules documented even though there's only one route
today, per §5.2's model-routing ADR requirement). Every agent turn is written to a
user-visible, human-readable activity log (§3.3).
**Acceptance criteria:**
- Given a user sends a text message, when the agent responds, then the exchange
  appears in the activity log with timestamp, correlation ID, and outcome.
- Given the model provider call fails (network error), when the agent handles it,
  then the user sees a clear, non-silent failure message, not a hang or a swallowed
  error (§4.6).

### 0.5 — Basic Voice Loop
**Deliverable:** `packages/voice` — push-to-talk capture (hotkey, no wake word),
single-utterance STT, single-agent turn, TTS playback of the response. Documented
explicitly as a deliberately reduced slice of the full §6 spec.
**Acceptance criteria:**
- Given the hotkey is pressed and held, when the user speaks and releases it, then
  the transcribed text is shown before being sent to the agent (so misheard input is
  visible, §6.3).
- Given no network connectivity, when the user tries voice input, then they see a
  clear "voice requires a connection" message rather than a silent failure (on-device
  STT/TTS is out of scope for 0.5; revisit if local-first voice becomes a Phase 0
  hard requirement).

### 0.6 — Desktop Shell & First-Run Onboarding
**Deliverable:** `apps/desktop` (Tauri) — thin UI hosting the chat surface, hotkey
registration, and the first-run journey from §3.1: explicit microphone-permission
grant screen (plain-language description, per §7) before any voice feature is
reachable. A design-token skeleton in `packages/ui-kit` (`/docs/DESIGN_SYSTEM.md`
stub: color tokens, spacing scale, light/dark mode) precedes any screen build, per
§14.
**Acceptance criteria:**
- Given first launch, when onboarding completes without granting microphone access,
  then voice features are visibly disabled and text chat still works.
- Given light/dark OS theme, when the app opens, then it renders from the same
  token set in both modes (§14 — "not two parallel stylesheets").

### 0.7 — Tests & Regression Baseline
**Deliverable:** Unit tests for `core`, `agents`, `orchestrator`, `voice` business
logic; integration tests for `api`↔Postgres and `desktop`↔`voice` boundaries (§15);
one end-to-end test covering the "first run → grant mic → have a conversation"
journey (§3.1 journey 1, reduced to Phase 0 scope). This suite becomes the
regression baseline that must pass before Phase 0 is marked complete and before
every future phase (§17 step 4).

## Out-of-Scope Decisions Deferred to Follow-Up ADRs

- ORM/query layer choice for Postgres (Prisma vs Drizzle) — decide at the start of
  0.3.
- LLM provider/model routing specifics for the single agent — decide at the start of
  0.4 (will default to the Claude API per this environment, documented as an ADR).
- STT/TTS vendor choice for 0.5 (cloud API vs local model) — decide at the start of
  0.5.

## Definition of Done for Phase 0

All sub-phases 0.1–0.7 complete, `PROJECT_INDEX.md` updated with real module
locations and test status, `CHANGELOG.md` entry added, full regression suite green,
and a working desktop app that can be launched to complete the first-run → voice or
text conversation journey end to end.
