# ADR-0008: Client Actions for Tools the Server Can't Actually Perform

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Project owner ("add more features"), Claude Code

## Context

Two genuinely useful "jarvis-like" actions — setting a timer/reminder and copying text to the clipboard — don't fit the tool-calling model ADR-0006/0007 established, where a tool's `execute()` runs server-side in `apps/api` and its effect is real by the time the function returns. Neither can work that way here:

- **Timers**: `apps/api` is deployed as a Netlify Function (ADR-0007) — a stateless, short-lived process with no way to hold a `setTimeout` across requests, let alone push a notification back to the browser later. Even the local persistent-server deployment can't survive a restart mid-timer.
- **Clipboard**: only the browser has access to the user's actual clipboard (`navigator.clipboard`). Neither a Lambda function nor a local Node server process can touch it.

## Decision

**Tools can return a `clientAction` instead of just a confirmation string.** `ToolHandler.execute` in `packages/agents/src/chat-agent.ts` now returns `Promise<string | ToolExecutionResult>`, where `ToolExecutionResult = { result: string; clientAction: ClientAction }` and `ClientAction = { type: string; payload: Record<string, unknown> }`. The server-side `execute()` still runs and still validates its arguments (a timer's `seconds` bounds, non-empty clipboard text) — it just can't perform the *effect*, only describe it. `ChatAgent.respond()` collects every `clientAction` emitted during a turn's tool round-trip into `ChatTurnResult.clientActions: ClientAction[]`, which `POST /v1/chat` (`apps/api/src/routes/chat.ts`) passes straight through in its response body.

The frontend (`apps/desktop/src/client-actions.ts`) dispatches each action by `type` after a successful send: `set_timer` requests Notification permission once, then `setTimeout`s the actual notification (falling back to a flashing document title if permission is denied — a real, if lesser, fallback rather than silently doing nothing); `copy_to_clipboard` calls `navigator.clipboard.writeText()`. Both are best-effort and fire-and-forget from `ChatView.tsx`'s perspective — a client action failing is never surfaced as a chat error, since the assistant's text reply already told the user what it did.

Existing tools (`open_url`, `create_file`, etc.) are untouched — they still just return a plain string, which `executeTool` passes through unchanged. The union return type means zero migration cost for tools that don't need this.

## Consequences

- The `clientActions` array can be silently ignored by any client that doesn't know about a given `type` (`runClientAction`'s `default` case) — forward-compatible if the API adds a new client action type before every client is updated, and safe for `apps/desktop`'s Tauri build talking to an older/newer API.
- A client action is genuinely fire-and-forget: if the tab closes before a timer fires, the timer is lost — there is no server-side durability for it. Acceptable for a personal-assistant timer (the user is expected to keep the tab/app open, the same assumption any browser-based timer app makes), not acceptable if this pattern were ever extended to something requiring guaranteed delivery (that would need real backend scheduling + push notifications, out of scope here).
- `set_timer` and `copy_to_clipboard` are always-available (no `Capability.SystemControl` gate, unlike `open_app`/`create_file`) — neither touches the OS or the filesystem, so they don't carry the same risk `system_control` exists to gate.

## Alternatives Considered

- **A dedicated `/v1/timers` endpoint with server-side scheduling** — rejected as over-engineering for what's fundamentally a client-side `setTimeout` with a notification; would require persistent infrastructure (a job queue, a way to push to a specific client) this project doesn't have and doesn't need for a personal single-session timer.
- **Encoding the action inside the reply text for the frontend to regex out** — rejected outright; parsing structured intent out of natural-language model output is exactly the fragility tool-calling exists to avoid.
- **Giving the model a raw "run this JS" tool** — rejected for the same reason arbitrary command execution was rejected in ADR-0006: it collapses the tool allowlist down to nothing, turning every future prompt-injection risk into full client-side code execution.
