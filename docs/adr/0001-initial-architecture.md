# ADR-0001: Initial Architecture & Stack

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** User (product owner), Claude Code (technical lead)
- **Supersedes:** none

## Context

Omnira is specified in the master prompt as a commercial-grade, multi-phase platform
(desktop AI companion → multi-agent core → browser automation → coding assistant →
multi-tenant SaaS). It must be built phase by phase, never all at once, with a
persistent project index and ADR log as the source of truth across sessions
(`omnira/docs/SPECIFICATION.md`, Sections 1, 17).

Before any implementation, the following foundational decisions must be locked in
because they touch every package in the monorepo and are expensive to reverse later:
architecture style, primary language, monorepo tooling, desktop shell, and core
storage technologies.

## Decision

1. **Architecture style: Modular monolith.** One deployable backend service with
   strict internal module boundaries (`core`, `agents`, `orchestrator`,
   `desktop-bridge`, `browser-bridge`, `file-intel`, `voice`, `automation`,
   `billing`, `admin`) mirroring the eventual service boundaries. No microservices
   until a real scaling or team-ownership constraint forces a split.

2. **Primary language: TypeScript everywhere, strict mode.** Backend API,
   agents/orchestrator, desktop bridge, and both UI apps (desktop shell, web-admin)
   are all TypeScript. Chosen over a Python-backend split so the whole team (human +
   agent) works in one language, one type system, and one dependency toolchain — this
   removes an entire class of contract-drift bugs between a Python agents layer and a
   TS UI layer. Python remains an option later, isolated behind a typed RPC boundary,
   if a specific ML workload genuinely needs it.

3. **Monorepo tooling: pnpm workspaces + Turborepo.** pnpm for fast, disk-efficient,
   strict dependency resolution (no phantom deps, which matters when many internal
   packages share a workspace); Turborepo for task orchestration/caching across the
   `/apps` and `/packages` structure defined in the master prompt (Section 4.2).

4. **Desktop shell: Tauri.** Rust-backed webview shell instead of Electron. Omnira's
   desktop app is explicitly an "AI OS layer" with deep, permissioned system access
   (Section 7) — Tauri's smaller attack surface, lower memory footprint, and
   Rust-side permission chokepoints fit that model better than Electron's full
   Chromium+Node runtime. Tradeoff accepted: the desktop-bridge module will need a
   thin Rust layer (via Tauri commands) in addition to its TypeScript side, and the
   team/agent must maintain competency in both.

5. **Primary datastore: PostgreSQL**, with **Redis** for cache/session/queue
   (BullMQ) and a **vector store** (pgvector inside the same Postgres instance for
   Phase 0–2, revisit a dedicated vector DB only if query patterns demand it) for
   embeddings. Local-first storage for sensitive on-device data per Section 4.5,
   cloud sync opt-in and encrypted.

6. **API style: REST, versioned (`/v1/...`).** Chosen over GraphQL for Phase 0
   because the initial surface (auth, sync, billing, tenancy) is small,
   resource-shaped, and REST keeps tooling (codegen, caching, rate limiting) simple.
   Internal agent/tool calls use a typed RPC-style contract (function-call schemas),
   not REST. This can be revisited with a new ADR if the API surface grows in a way
   that genuinely benefits from GraphQL's query flexibility (e.g. the knowledge
   graph or admin analytics surface in later phases).

7. **Error envelope (all REST responses):**
   `{ error: { code, message, details, requestId } }` per Section 4.4, no
   exceptions.

## Consequences

- Every new package in `/packages` and `/apps` is TypeScript, strict mode, sharing
  root `tsconfig.base.json`, ESLint, and Prettier config — documented in
  `/docs/CONVENTIONS.md` once Phase 0 begins.
- The desktop-bridge module is the only place Rust/Tauri-native code lives; all
  higher-level logic (permission checks, activity logging) stays in TypeScript and
  calls down through a narrow, typed command interface.
- Postgres + pgvector means one fewer service to operate in early phases; if
  embedding volume/query latency becomes a real bottleneck, a follow-up ADR will
  cover migrating to a dedicated vector store.
- REST is the default for all `/v1` endpoints; any future GraphQL adoption is
  additive and scoped, not a replacement.

## Alternatives Considered

- **Python backend + TS frontend** — rejected for Phase 0: better access to Python's
  ML ecosystem, but doubles the type-contract surface between agents and UI at a
  stage where the team is a single engineer + agent. Revisit if a specific model/
  training workload needs Python-only tooling.
- **Electron** — rejected: mature ecosystem and easier hiring, but heavier runtime
  and weaker default security boundary than a project whose core premise is deep,
  permissioned OS access.
- **Microservices from day one** — rejected per Section 4.1: premature for current
  team size; the modular monolith's package boundaries are designed to extract
  cleanly later.
- **GraphQL from day one** — rejected for Phase 0: adds schema/tooling overhead not
  justified by the initial small, resource-shaped API surface.
