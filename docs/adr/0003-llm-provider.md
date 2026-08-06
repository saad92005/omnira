# ADR-0003: LLM Provider for the Phase 0 Single Agent

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Claude Code (technical lead)
- **Supersedes:** none

## Context

Phase 0.4 needs one concrete model provider behind `packages/orchestrator`'s
typed provider interface (master prompt §5.2 — "model routing... document
routing rules in an ADR"). Phase 0 has exactly one route: the single chat
agent's turn.

## Decision

**Anthropic Claude, via the official `@anthropic-ai/sdk`, model
`claude-opus-5`, streamed.**

- Provider interface (`ModelProvider` in `packages/orchestrator`) is
  vendor-agnostic — a `generateReply(conversation): AsyncIterable<TextDelta>`
  shape — so a second provider can be added later without touching
  `packages/agents`.
- The concrete `AnthropicProvider` implementation calls
  `client.messages.stream(...)` and exposes `getFinalMessage()` for the
  activity log, per the official SDK's recommended streaming pattern.
- Model routing rule for Phase 0 (trivially simple, since there is one
  route): every single-agent chat turn uses `claude-opus-5`. Per-sub-task
  cheap/expensive routing (§5.2's "smallest capable model for
  classification/extraction, most capable for planning/codegen") becomes a
  real design question starting Phase 2 (multi-agent core) and is deferred
  there.
- No tool use in Phase 0 — the single agent is plain conversational chat.
  Tool-calling is introduced with the Planner/Researcher/Developer agents in
  Phase 2.
- Adaptive thinking is left at its default (on) rather than explicitly
  configured, since Phase 0 chat has no need to tune reasoning depth yet;
  `output_config.effort` is left unset (defaults to `high`).

## Consequences

- `ANTHROPIC_API_KEY` is a required env var for `apps/api` in any environment
  that needs to actually exercise the chat agent (validated by
  `packages/core`'s config loader — see `docs/features/phase-0-foundation.md`
  §0.2). Local development and CI without a key can still build, lint, and
  run every test that doesn't call the live API (the `AnthropicProvider` is
  unit-tested against a mocked SDK client).
- Every agent turn — request and response — is written to the activity log
  via `packages/core`'s logger with the request's correlation ID, satisfying
  §3.3's "every agent action is logged."

## Alternatives Considered

- **OpenAI / other providers** — rejected: no stated requirement favors a
  different vendor, and Anthropic's SDK is already the toolchain this whole
  project is being built with.
- **A model router from day one** (smallest model for trivial replies,
  larger for complex ones) — rejected for Phase 0: single-agent chat has
  exactly one route; building routing logic now is premature given §5.2
  explicitly ties model routing to the multi-agent system that doesn't exist
  until Phase 2.
