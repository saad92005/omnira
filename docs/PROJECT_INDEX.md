# Omnira Project Index

> Source of truth for current project state. Read this first at the start of
> every session — do not re-derive state from guessing. Standing constitution:
> [`/CLAUDE_MASTER_PROMPT.md`](../CLAUDE_MASTER_PROMPT.md).

## Current Phase

**Phase 0 (Foundation) — implementation complete, unverified items called out
below.** All seven sub-phases from
[`docs/features/phase-0-foundation.md`](features/phase-0-foundation.md) have
working code, and the full regression suite (`pnpm build && pnpm lint &&
pnpm typecheck && pnpm test`) is green. Chat and speech-to-text run on
Groq's free tier and spoken replies use the browser's built-in
`speechSynthesis` (ADR-0005, superseding ADR-0003/0004) — no paid API key
required anywhere in Phase 0. What's *not* done: a live end-to-end run
against a real Postgres and the Groq API, and a real Tauri build — none of
those services/toolchains were available in the environment this was built
in. See "Known Issues / Tech Debt".

## Completed Modules (with location + test status)

| Module | Location | Tests | Notes |
|---|---|---|---|
| Monorepo scaffold | root, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json` | n/a (config) | pnpm workspaces + Turborepo, strict TS |
| Core (config, logger, errors, permissions) | `packages/core` | 17 tests, green | `loadConfig`, `createRootLogger`, `OmniraError` hierarchy, `Capability` model |
| Orchestrator (model provider) | `packages/orchestrator` | 3 tests, green | `ModelProvider` interface + `GroqProvider` (llama-3.3-70b-versatile via OpenAI-compatible SDK, mocked-SDK tests) |
| Agents (chat agent) | `packages/agents` | 6 tests, green | `ConversationState`, `ChatAgent`, activity logging |
| Voice (STT provider) | `packages/voice` | 5 tests, green | `GroqSttProvider` (Whisper, mocked-fetch tests); no server-side TTS — see ADR-0005 |
| UI kit (design tokens + components) | `packages/ui-kit` | 5 tests, green | `tokens.css`/`tokens.ts`, `Button`, `MicButton`, `MessageBubble` |
| API (auth, permissions, chat, voice routes) | `apps/api` | 10 unit tests green; 1 integration test file **not run** (needs Postgres) | Fastify + Prisma; see Known Issues |
| Desktop shell | `apps/desktop` | 3 tests, green | React/Vite frontend verified (build + test); client-side TTS via `speechSynthesis` (`src/speech.ts`); **Tauri/Rust side unverified**, see Known Issues |

Full regression command: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`
— all green as of this entry.

## In Progress

Nothing mid-implementation. Phase 0 code is complete; what remains is
verification that requires infrastructure not present in this session
(below), and the project owner's decision on whether to proceed to Phase 1.

## Not Started

Phases 1–6 per `/CLAUDE_MASTER_PROMPT.md` §2.3: Desktop Companion (file
intelligence, app launching, window/clipboard control), Multi-Agent Core,
Browser & Automation, Coding Assistant, SaaS Platform, Scale & Compliance.

## Known Issues / Tech Debt

1. **Never run against live infrastructure.** This environment had no
   running Postgres and no Rust toolchain. Every unit test that could run
   without those (51 tests across 7 packages) passes; anything requiring
   external services is implemented from documented API contracts but
   **not independently verified**. Concretely:
   - `apps/api/src/server.integration.test.ts` needs `docker compose up -d db`
     + `pnpm --filter @omnira/api prisma:migrate` — never executed.
   - `GroqProvider` (chat) and `GroqSttProvider` (voice) are unit-tested
     against a mocked SDK/fetch, **and** the chat endpoint was smoke-tested
     live with a raw `curl` against `api.groq.com` using the real
     `GROQ_API_KEY` — confirmed the key, model ID (`llama-3.3-70b-versatile`),
     and response shape all match what `GroqProvider` expects. The STT
     endpoint's request/response shape was confirmed against Groq's docs but
     not smoke-tested live (a `curl` multipart-upload attempt hit an
     unrelated local file-path issue in this shell, not a Groq problem).
     Neither was exercised through the actual running `apps/api` server
     (that still needs Postgres — see below).
   - `apps/desktop/src-tauri` (Rust) has never been compiled — no `rustc` in
     this environment. It follows the standard `create-tauri-app` v2 shape;
     treat it as unverified until built once.
2. **Conversation storage is in-memory** (`apps/api/src/routes/chat.ts`) —
   restarting the API process loses all conversations. No `conversations`
   table exists yet; that's Phase 1+ persistence work, called out explicitly
   in the route's code comment.
3. **Tauri app icons are not generated** — `src-tauri/icons/` has only a
   README explaining the `tauri icon` command to run. Blocks `tauri build`
   (a full bundle), not `tauri dev`.
4. **Onboarding "has completed onboarding" is not persisted** — it re-runs
   every app launch in this session's implementation (`apps/desktop/src/App.tsx`).
   Noted as a Phase 1 follow-up in that file's doc comment.
5. **No CI pipeline configured yet** — regression checks are run manually via
   the command above. Setting up CI is reasonable early Phase 1 work but was
   not explicitly in Phase 0's scope.
6. **Groq free-tier rate limits** — no retry/backoff logic exists yet for
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

## Next Session Should Start With

1. Read this file and `/CLAUDE_MASTER_PROMPT.md` in full.
2. **Do the human-in-the-loop setup**: `docker compose up -d db` + migrate,
   a Rust toolchain + one `tauri dev` run, and confirm the walking skeleton
   actually works end-to-end: sign up → grant mic → text chat replies via
   Groq → voice transcribe (Groq Whisper) → spoken reply (browser TTS).
3. Fix anything that setup step surfaces (this is expected — nothing above
   was live-verified) before treating Phase 0 as done.
4. Only after that: write the Phase 1 (Desktop Companion) feature doc under
   `/docs/features/` and confirm scope with the project owner before
   implementing, per the master prompt's mandatory phased workflow (§17).
