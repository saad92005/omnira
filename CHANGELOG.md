# Changelog

All notable changes to this project will be documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Project governance scaffolding: `/docs/SPECIFICATION.md`,
  `/docs/PROJECT_INDEX.md`, ADR-0001 through ADR-0005.
- **Phase 0 (Foundation) — full implementation:**
  - Monorepo scaffold: pnpm workspaces + Turborepo, strict TypeScript,
    shared ESLint/Prettier config, `/docs/CONVENTIONS.md`.
  - `packages/core`: environment config loader, structured logger with
    correlation IDs, typed error hierarchy + REST error envelope, the
    capability permission model.
  - `apps/api`: Fastify REST API (`/v1`), Prisma + Postgres, JWT
    access/refresh-token auth with rotation, capability permission grants,
    a single-agent chat endpoint, and a voice transcription endpoint.
  - `packages/orchestrator`: vendor-agnostic `ModelProvider` interface +
    `GroqProvider` (streamed, OpenAI-compatible).
  - `packages/agents`: `ConversationState` (explicit, inspectable) and
    `ChatAgent`, with every turn written to the activity log.
  - `packages/voice`: `SttProvider` interface + `GroqSttProvider` (Whisper)
    implementation.
  - `packages/ui-kit`: design tokens (`/docs/DESIGN_SYSTEM.md`) and
    `Button`/`MicButton`/`MessageBubble` components.
  - `apps/desktop`: Tauri v2 shell + React/Vite frontend — first-run
    onboarding (microphone permission), sign-in, and chat UI with
    push-to-talk voice (spoken replies via the browser's native
    `speechSynthesis`).
  - `docker-compose.yml` for local Postgres.
  - Full regression suite (build, lint, typecheck, 51 unit tests) green.

### Changed

- **ADR-0005**: switched chat and speech-to-text from Anthropic/OpenAI to
  Groq's free tier (no paid API key required), and moved text-to-speech
  entirely client-side to the browser's native `speechSynthesis` (no vendor
  at all). Supersedes ADR-0003 and ADR-0004, whose original reasoning is
  preserved in place with a status update, not rewritten.
- **Phase 0 verified live, end to end.** Installed Rust + MSVC Build Tools;
  `cargo build` produced a real linked `omnira-desktop.exe`, and `tauri dev`
  launched it as an actual window (confirmed via screenshot: onboarding/
  sign-in screen rendering correctly). Local Docker Postgres couldn't start
  in this environment (virtualization disabled in firmware — Docker Desktop
  fails outright, not a first-run-dialog issue); switched to a free-tier
  hosted Postgres (Neon) instead, migrated the schema, and ran a full
  `curl`-driven smoke test against the live server: register → login →
  real Groq chat reply → permission grant/revoke correctly flips
  `voice-available` → refresh-token rotation confirmed (reused token
  correctly rejected).

### Fixed

- `apps/desktop`: network-level `fetch()` failures (server unreachable) were
  surfacing the raw browser error ("Failed to fetch") instead of a friendly
  message — found by running the app against a stopped backend. Centralized
  the fix in `api-client.ts`'s `request()` so every call site gets it.
