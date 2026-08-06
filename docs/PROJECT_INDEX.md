# Omnira Project Index

> Source of truth for current project state. Read this first at the start of
> every session — do not re-derive state from guessing. Standing constitution:
> [`/CLAUDE_MASTER_PROMPT.md`](../CLAUDE_MASTER_PROMPT.md).

## Current Phase

**Phase 0 (Foundation) — implementation complete, unverified items called out
below.** All seven sub-phases from
[`docs/features/phase-0-foundation.md`](features/phase-0-foundation.md) have
working code, and the full regression suite (`pnpm build && pnpm lint &&
pnpm typecheck && pnpm test`) is green. What's *not* done: a live end-to-end
run against a real Postgres, Anthropic, and OpenAI, and a real Tauri build —
none of those services/toolchains were available in the environment this was
built in. See "Known Issues / Tech Debt" and the human-in-the-loop
requirements the project owner has been given separately.

## Completed Modules (with location + test status)

| Module | Location | Tests | Notes |
|---|---|---|---|
| Monorepo scaffold | root, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json` | n/a (config) | pnpm workspaces + Turborepo, strict TS |
| Core (config, logger, errors, permissions) | `packages/core` | 17 tests, green | `loadConfig`, `createRootLogger`, `OmniraError` hierarchy, `Capability` model |
| Orchestrator (model provider) | `packages/orchestrator` | 3 tests, green | `ModelProvider` interface + `AnthropicProvider` (claude-opus-5, mocked-SDK tests) |
| Agents (chat agent) | `packages/agents` | 6 tests, green | `ConversationState`, `ChatAgent`, activity logging |
| Voice (STT/TTS providers) | `packages/voice` | 7 tests, green | `OpenAiSttProvider`, `OpenAiTtsProvider` (mocked-fetch tests) |
| UI kit (design tokens + components) | `packages/ui-kit` | 5 tests, green | `tokens.css`/`tokens.ts`, `Button`, `MicButton`, `MessageBubble` |
| API (auth, permissions, chat, voice routes) | `apps/api` | 10 unit tests green; 1 integration test file **not run** (needs Postgres) | Fastify + Prisma; see Known Issues |
| Desktop shell | `apps/desktop` | 3 tests, green | React/Vite frontend verified (build + test); **Tauri/Rust side unverified**, see Known Issues |

Full regression command: `pnpm build && pnpm lint && pnpm typecheck && pnpm test`
— all green as of this entry.

## In Progress

Nothing mid-implementation. Phase 0 code is complete; what remains is
verification that requires infrastructure/credentials not present in this
session (below), and the project owner's decision on whether to proceed to
Phase 1.

## Not Started

Phases 1–6 per `/CLAUDE_MASTER_PROMPT.md` §2.3: Desktop Companion (file
intelligence, app launching, window/clipboard control), Multi-Agent Core,
Browser & Automation, Coding Assistant, SaaS Platform, Scale & Compliance.

## Known Issues / Tech Debt

1. **Never run against live infrastructure.** This environment had no
   running Postgres, no `ANTHROPIC_API_KEY`, no `OPENAI_API_KEY`, and no Rust
   toolchain. Every unit test that could run without those (51 tests across
   7 packages) passes; anything requiring them is implemented from the
   documented API contracts but **not independently verified**. Concretely:
   - `apps/api/src/server.integration.test.ts` needs `docker compose up -d db`
     + `pnpm --filter @omnira/api prisma:migrate` — never executed.
   - `AnthropicProvider` (chat) and `OpenAiSttProvider`/`OpenAiTtsProvider`
     (voice) are unit-tested against mocked SDK/fetch calls only. A real
     `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` end-to-end call has not happened.
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

## Key Decisions (links to ADRs)

- [ADR-0001: Initial Architecture & Stack](adr/0001-initial-architecture.md)
  — modular monolith, TypeScript everywhere, pnpm + Turborepo, Tauri desktop
  shell, Postgres + pgvector + Redis, REST `/v1` API.
- [ADR-0002: ORM Choice](adr/0002-orm-choice.md) — Prisma for `apps/api`.
- [ADR-0003: LLM Provider](adr/0003-llm-provider.md) — Anthropic Claude
  (`claude-opus-5`) via `@anthropic-ai/sdk`, streamed, no tools in Phase 0.
- [ADR-0004: STT/TTS Vendor](adr/0004-stt-tts-vendor.md) — OpenAI (Whisper +
  TTS REST endpoints), single vendor, no SDK dependency.

## Next Session Should Start With

1. Read this file and `/CLAUDE_MASTER_PROMPT.md` in full.
2. **Do the human-in-the-loop setup** (see the project owner's copy of the
   "what's needed from you" list from the session that built this — API
   keys, `docker compose up -d db` + migrate, Rust toolchain + one
   `tauri dev` run) and confirm the walking skeleton actually works
   end-to-end: sign up → grant mic → text chat replies → voice
   transcribe/speak round-trip.
3. Fix anything that setup step surfaces (this is expected — nothing above
   was live-verified) before treating Phase 0 as done.
4. Only after that: write the Phase 1 (Desktop Companion) feature doc under
   `/docs/features/` and confirm scope with the project owner before
   implementing, per the master prompt's mandatory phased workflow (§17).
