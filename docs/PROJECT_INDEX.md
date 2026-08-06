# Omnira Project Index

> Source of truth for current project state. Read this first at the start of every
> session — do not re-derive state from guessing. Standing constitution:
> [`/CLAUDE_MASTER_PROMPT.md`](../CLAUDE_MASTER_PROMPT.md).

## Current Phase

**Pre-Phase-0 — Foundation setup.** Repository scaffolding and governing docs are in
place. Concrete Phase 0 scope has been proposed to the project owner and is awaiting
confirmation before any implementation code is written (per master prompt, Final
Instruction #2).

## Completed Modules (with location + test status)

_None yet — no implementation code has been written._

| Module | Location | Tests | Notes |
|---|---|---|---|
| — | — | — | — |

## In Progress

- Phase 0 scope proposal — written, pending owner confirmation.

## Not Started

Everything in the roadmap (master prompt §2.3): Phase 0 (Foundation) through Phase 6
(Scale & Compliance). See `/CLAUDE_MASTER_PROMPT.md` §2.3 for the full list.

## Known Issues / Tech Debt

_None — project has no code yet._

## Key Decisions (links to ADRs)

- [ADR-0001: Initial Architecture & Stack](adr/0001-initial-architecture.md) —
  modular monolith, TypeScript everywhere, pnpm + Turborepo, Tauri desktop shell,
  Postgres + pgvector + Redis, REST `/v1` API.

## Next Session Should Start With

1. Read this file and `/CLAUDE_MASTER_PROMPT.md` in full.
2. If the Phase 0 plan has been confirmed (check for a `## Phase 0 Plan` section
   below, added once approved) and no implementation exists yet: begin
   implementation per that plan, starting with monorepo scaffolding
   (`pnpm-workspace.yaml`, root `tsconfig.base.json`, ESLint/Prettier config,
   `/docs/CONVENTIONS.md`).
3. If the Phase 0 plan has not been confirmed: do not write implementation code —
   surface the pending plan to the user again.
