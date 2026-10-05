# Omnira Project Index

> Source of truth for current project state. Read this first at the start of
> every session — do not re-derive state from guessing. Standing constitution:
> [`/docs/SPECIFICATION.md`](SPECIFICATION.md).

## Current Phase

**Phase 0 (Foundation) — complete and live-verified end to end**, plus two
follow-on rounds of project-owner-requested polish (tracked here, no formal
phase doc): "Phase 8" — Aurora v1.1/1.2 dark glassmorphic redesign with 3D
depth, persisted conversation history with a sidebar + New Chat control,
permission-gated system control (open app/URL) via tool calling (ADR-0006),
an auto-focus fix, and a real Windows installer build via `tauri build`;
"Phase 9" — an Aurora v1.3 "HUD" instrument-panel redesign of the chat
screen, expanded system control (`create_file`/`create_folder`, ADR-0007),
a real system prompt (persona, spoken-confirmation style, Roman Urdu
support), a persisted voice-mode toggle that closes the speak → act → hear
loop, and a PWA manifest/service worker so the web build is installable on
mobile; "Phase 10" — **actually deployed publicly**, not just PWA-ready:
`apps/api` now also runs as Netlify Functions (a genuinely difficult port —
see `apps/api/src/db.ts` and `netlify.toml` for the Prisma/serverless
bundling fixes, verified by running Netlify's real build pipeline locally
before ever deploying), live at a real HTTPS URL serving both the API and
the web build from one site, plus true 3D transforms (v1.4, not just depth
cues) and three new tools (`set_timer`, `copy_to_clipboard`, conversation
export) via a new "client action" pattern (ADR-0008) for effects only the
browser can perform. All seven sub-phases from
[`docs/features/phase-0-foundation.md`](features/phase-0-foundation.md) have
working code, the full regression suite (`pnpm build && pnpm lint &&
pnpm typecheck && pnpm test`) is green, and the whole walking skeleton has
been exercised for real — not just against mocks:

- **Backend, live:** a real Postgres (Neon free tier — no Docker/virtualization
  needed, see Known Issues #1), migrated with Prisma, running behind
  `apps/api`. Curl-driven smoke test against the running server: register →
  login → **real Groq chat reply** ("Pong") → grant microphone permission →
  `voice-available` flips `true` → revoke → flips back to `false`
  immediately → refresh-token rotation confirmed (old token rejected 401
  after use). Every one of these hit live infrastructure, not a stub.
- **Desktop, live:** Rust + MSVC Build Tools installed; `cargo build`
  produced a real linked `omnira-desktop.exe`; `pnpm tauri dev` launched an
  actual window rendering the onboarding/sign-in screen with the correct
  design tokens (confirmed via a screenshot from the project owner). A full
  `tauri build` release bundle was also run and verified for real: the NSIS
  installer (`Omnira_0.0.0_x64-setup.exe`) was silently installed
  (`%LOCALAPPDATA%\Omnira`, no admin needed), the installed `.exe` was
  launched and confirmed running with a live window, then cleanly
  uninstalled via its own uninstaller. The MSI bundle also built
  successfully but needs admin rights to install (WiX per-machine default,
  `Error 1925` without it) — not a defect, just the expected difference
  between the two installer types (see README).
- No paid API key anywhere (ADR-0005: Groq free tier for chat + STT, browser
  `speechSynthesis` for TTS) and no Docker/virtualization dependency (Neon
  free-tier Postgres instead of local Docker — virtualization is disabled in
  this machine's firmware, so Docker Desktop cannot run here at all).

## Completed Modules (with location + test status)

| Module | Location | Tests | Notes |
|---|---|---|---|
| Monorepo scaffold | root, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json` | n/a (config) | pnpm workspaces + Turborepo, strict TS |
| Core (config, logger, errors, permissions) | `packages/core` | 17 tests, green | `loadConfig`, `createRootLogger`, `OmniraError` hierarchy, `Capability` model |
| Orchestrator (model provider) | `packages/orchestrator` | 3 tests, green | `ModelProvider` + `GroqProvider` — **live-verified** (real chat reply through the running API) |
| Agents (chat agent) | `packages/agents` | 6 tests, green | `ConversationState`, `ChatAgent`, activity logging |
| Voice (STT provider) | `packages/voice` | 5 tests, green | `GroqSttProvider` (Whisper) — unit-tested against mocked fetch; **not yet** smoke-tested with a real audio file (see Known Issues) |
| UI kit (design tokens + components) | `packages/ui-kit` | 5 tests, green | `tokens.css`/`tokens.ts`, `Button`, `MicButton`, `MessageBubble` — **live-verified** (rendered correctly in the running desktop app) |
| API (auth, permissions, chat, voice routes) | `apps/api` | 10 unit tests green | Fastify + Prisma, **live-verified** against real Neon Postgres — see Current Phase above |
| Desktop shell | `apps/desktop` | 4 tests, green | React/Vite + Tauri/Rust, **live-verified**: real build, real launched window |

Full regression command: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`
— all green as of this entry.

## In Progress

Nothing mid-implementation. Phase 0 is functionally complete and verified.
What's left is small polish items (Known Issues below) and the project
owner's decision on whether to proceed to Phase 1.

## Not Started

Phases 1–6 per `/docs/SPECIFICATION.md` §2.3: Desktop Companion (file
intelligence, app launching, window/clipboard control), Multi-Agent Core,
Browser & Automation, Coding Assistant, SaaS Platform, Scale & Compliance.

## Known Issues / Tech Debt

1. **No local Docker/Postgres — virtualization is disabled in this
   machine's firmware** (`systeminfo` reports `Virtualization Enabled In
   Firmware: No`), so Docker Desktop cannot start here at all (confirmed:
   it fails with "Virtualization support not detected"). Worked around by
   using a free-tier hosted Postgres (Neon) instead — `docker-compose.yml`
   and the `test:integration` script still target local Postgres for
   anyone whose machine *does* have virtualization enabled; on a machine
   like this one, point `DATABASE_URL` at a hosted instance (Neon/Supabase
   free tier) instead. `apps/api/src/server.integration.test.ts` itself
   was still not run in this session (the live verification instead used
   ad hoc `curl` against the running dev server — see Current Phase).
2. **Voice transcription (Groq Whisper) not smoke-tested with real audio.**
   The chat path was verified live (real Groq reply); the STT endpoint's
   wire contract was confirmed against Groq's docs and unit-tested against
   mocked `fetch`, but no actual audio file was ever POSTed to
   `/v1/voice/transcribe` in this session. Try it from the running desktop
   app (hold the mic button) for the real test.
3. ~~Conversation storage is in-memory~~ — **resolved.** Conversations and
   messages now persist to Postgres (`Conversation`/`Message` Prisma models,
   `apps/api/src/conversations/service.ts`), with a sidebar + New Chat
   control in the desktop app to browse and start conversations.
4. **Tauri app icons are placeholders, not real artwork** — a generated
   brand-accent circle, just enough to satisfy the build. See
   `src-tauri/icons/README.md` for how to regenerate from real artwork.
   A full `tauri build` release bundle has now been run and verified on
   Windows — real `.msi` and NSIS `.exe` installers, see README's
   "Building a distributable app" section — but the icon itself is still
   a placeholder, and macOS/Linux bundles have not been built (require
   building on those OSes — Tauri doesn't cross-compile native bundles).
5. **Onboarding "has completed onboarding" is not persisted** — it re-runs
   every app launch in this session's implementation (`apps/desktop/src/App.tsx`).
   Noted as a Phase 1 follow-up in that file's doc comment.
6. **No CI pipeline configured yet** — regression checks are run manually via
   the command above. Setting up CI is reasonable early Phase 1 work but was
   not explicitly in Phase 0's scope.
7. **Groq free-tier rate limits** — no retry/backoff logic exists yet for
   429s from Groq; they surface as a plain `UpstreamError`. Fine for Phase 0
   development; revisit if this becomes a real usability problem.

## Key Decisions (links to ADRs)

- [ADR-0001: Initial Architecture & Stack](adr/0001-initial-architecture.md)
  — modular monolith, TypeScript everywhere, pnpm + Turborepo, Tauri desktop
  shell, Postgres + pgvector + Redis, REST `/v1` API.
- [ADR-0002: ORM Choice](adr/0002-orm-choice.md) — Prisma for `apps/api`.
- [ADR-0003: LLM Provider](adr/0003-llm-provider.md) *(superseded)* — the
  original Anthropic Claude decision.
- [ADR-0004: STT/TTS Vendor](adr/0004-stt-tts-vendor.md) *(superseded)* —
  the original OpenAI decision.
- [ADR-0005: Free-Tier Providers](adr/0005-free-tier-providers.md) —
  **current**: Groq (chat + STT, free tier, no card) + browser
  `speechSynthesis` (TTS, no vendor at all).
- [ADR-0006: Tool Calling & System Control](adr/0006-tool-calling-and-system-control.md)
  — permission-gated `open_url`/`open_app` tools via OpenAI-style function
  calling through Groq; allowlisted, `shell:false`, no arbitrary execution.
- [ADR-0007: Automation, Persona & Voice Loop](adr/0007-automation-persona-and-voice-loop.md)
  — `create_file`/`create_folder` (same allowlist discipline), the first
  real system prompt (spoken-style confirmations, Roman Urdu), and the
  persisted voice-mode toggle that closes the speak→act→hear loop.
- [ADR-0008: Client Actions for Tools](adr/0008-client-actions-for-tools.md)
  — `set_timer`/`copy_to_clipboard` return a `clientAction` instead of a
  plain string; the server validates and describes the effect, the browser
  (the only place that can hold a timer across requests or touch the
  clipboard) actually performs it.
- **Hosted Postgres over local Docker** — not yet its own ADR (should be
  written up if this becomes the permanent path rather than a one-off
  workaround for this machine's disabled virtualization); decision and
  rationale are captured in Known Issues #1 above for now.

## Next Session Should Start With

1. Read this file and `/docs/SPECIFICATION.md` in full.
2. Optional polish: smoke-test real audio through `/v1/voice/transcribe`,
   replace the placeholder app icons with real artwork, add CI, persist the
   "has completed onboarding" flag (Known Issue #5).
3. Otherwise: write the Phase 1 (Desktop Companion) feature doc under
   `/docs/features/` and confirm scope with the project owner before
   implementing, per the master prompt's mandatory phased workflow (§17).
