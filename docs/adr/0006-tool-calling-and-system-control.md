# ADR-0006: Permission-Gated Tool Calling for System Control

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Project owner ("add more features to make it a real jarvis-like system"), Claude Code

## Context

The project owner asked for Omnira to actually act on the world — open apps
and websites when asked — rather than only describing what it would do (the
Phase 0 behavior, verified live: asking it to "open chrome" produced an
explanation that the model had no system access). A naive implementation
would let the LLM emit an arbitrary shell command and `exec` it. That is a
direct command-injection / arbitrary-code-execution surface: the model's
output is effectively untrusted input, since prompt injection from any
source the model reads (a fetched page, a past message) could steer it into
producing a malicious command line.

## Decision

**OpenAI-style function/tool calling**, since Groq's endpoint (ADR-0005) is
OpenAI-API-compatible and supports it natively (`tools`, `tool_choice:
"auto"`, `tool_calls` on the assistant message). `ModelProvider.generateReply`
gained a third, optional `options` parameter carrying `tools:
ToolDefinition[]`; `GroqProvider` runs a bounded loop
(`MAX_TOOL_ROUNDS = 3`) that calls the model, executes any requested tool
calls, appends `role: "tool"` results, and re-calls until the model stops
requesting tools or the round cap is hit.

**Two tools, both narrow and allowlisted, no free-form execution:**

- `open_url` — validates the argument is a syntactically valid HTTP(S) URL
  (`isSafeHttpUrl`, `apps/api/src/tools/system-control.ts`) before opening
  it. No `file://`, no other scheme, no shell involved.
- `open_app` — takes one of four hardcoded names (`ALLOWED_APP_NAMES`:
  `browser`, `notepad`, `calculator`, `file_explorer`), each mapped in code
  to a specific executable. The model can never supply its own executable
  path or arguments.

Both are implemented with `child_process.spawn(..., { shell: false })` and
an argv array — never a string handed to a shell — so there is no
interpolation point for injection even if the allowlist mapping were
somehow bypassed.

**Gated behind a new capability**, `Capability.SystemControl`
(`packages/core/src/permissions.ts`), following the same
grant/revoke/`isActive` pattern already established for the microphone
capability in Phase 0. `buildToolHandlers(systemControlGranted: boolean)`
(`apps/api/src/tools/index.ts`) only includes `open_url`/`open_app` in the
tool list sent to the model when the capability is active — an ungranted
user's model literally never sees these tools exist, rather than seeing them
and being told no. `Onboarding.tsx` now asks for both capabilities
up front, each independently optional, matching the master prompt's
"permissions are never implied" rule.

## Consequences

- The model cannot run arbitrary commands, read/write arbitrary files, or
  reach arbitrary executables — the blast radius of a successful prompt
  injection against the tool-calling loop is capped at "open one of four
  known apps" or "open a URL in the default browser," both of which a user
  could already do themselves with one click.
- Extending the allowlist (a new app, a new action) is a code change and a
  new unit test, not a config value the model or user can expand — this is
  intentional friction, not an oversight.
- Verified live (not just unit tests): confirmed the tool is genuinely
  absent from the model's tool list when the capability is denied, and
  genuinely opens a real Notepad process (confirmed via `tasklist`) once
  granted.
- Three tool-call rounds is an arbitrary but generous cap for Phase 0 — a
  single user request should resolve in one round in the overwhelming
  majority of cases; revisit if a future multi-step agent workflow
  legitimately needs more.

## Alternatives Considered

- **Arbitrary shell command execution requested by the model** — rejected
  outright as a command-injection vector; never seriously considered as a
  real option despite being the "fastest" naive path.
- **A generic `run_app(path)` tool taking any executable path** — rejected;
  still lets a compromised or injected model launch anything on the
  filesystem the OS user can run. The fixed four-app allowlist was chosen
  specifically to eliminate this class of risk while still covering the
  concrete "open chrome" / "open notepad" requests already seen in testing.
- **OS-level sandboxing/permission prompts (Windows UAC-style per-call
  confirmation)** — deferred; the capability grant/revoke model already
  gives an explicit, revocable, plain-language consent step, and per-call
  confirmation would fight the "jarvis-like" voice-driven UX the feature
  exists to serve. Worth reconsidering if the allowlist grows to include
  anything higher-risk than the current four read-only-ish apps.
