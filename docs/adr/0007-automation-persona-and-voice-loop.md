# ADR-0007: Expanded Automation, Persona/Language, and the Voice-Mode Loop

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Project owner ("add more automation features... if I enable voice mode, it should reply with voice... enable Urdu conversation"), Claude Code

## Context

Three related gaps surfaced once ADR-0006's tool-calling landed: (1) the only real actions available were opening an app/URL — the project owner's own example, "make a file on desktop," had no tool to do it; (2) there was no system prompt at all, so the model had no instruction to confirm actions in short spoken-friendly sentences, and no language guidance; (3) the voice UI only ever filled the text input from a transcript — it never closed the loop of speak → act → hear a confirmation, which is the actual "jarvis-like" behavior being asked for.

## Decision

**File/folder creation, same allowlist discipline as ADR-0006.** `create_file`/`create_folder` (`apps/api/src/tools/system-control.ts`) write only inside two fixed, code-defined directories (`homedir()/Desktop`, `homedir()/Documents` — `SAFE_DIRS`), never an LLM-supplied path. Entry names are validated against path separators, traversal segments (`.`, `..`), and control characters, then re-checked that the resolved path is still a direct child of the allowlisted directory — the same "validate, then verify the resolved path didn't escape" pattern as `isSafeHttpUrl`. Both tools are gated behind `Capability.SystemControl`, alongside `open_url`/`open_app` — no new capability was introduced, since this is the same trust boundary ("Omnira can affect files/apps on your machine") the user already reasons about as one on/off decision.

**A real system prompt, added for the first time.** `ChatMessage.role` gained `"system"` (`packages/orchestrator/src/model-provider.ts`); `ChatAgent.respond` prepends a fixed `SYSTEM_PROMPT` ahead of conversation history on every turn (`packages/agents/src/chat-agent.ts`) — never persisted as a `ConversationTurn`, since it's Omnira's constant persona, not part of the user's conversation record. The prompt does three jobs: (a) sets a "capable personal assistant, not a chatbot" tone; (b) instructs plain, short, spoken-friendly confirmations after a tool succeeds (e.g. "I have made the file on your Desktop.") instead of a mechanical tool-call description; (c) instructs the model to mirror the user's language, explicitly calling out Roman Urdu (Urdu written in Latin script) as a language it should switch into and stay in when the user writes/speaks that way.

**Roman Urdu support is prompt-level, not a separate translation pipeline.** Groq's `llama-3.3-70b-versatile` already handles Roman Urdu reasonably as part of its training data; this is a behavioral instruction, not new infrastructure. TTS quality for Roman Urdu text through the browser's `speechSynthesis` (ADR-0005) will vary by which voices the OS has installed and is not guaranteed to sound natural — no claim of dedicated Urdu voice support is being made.

**Voice mode is an explicit, persisted toggle**, not an always-on behavior. `apps/desktop/src/chat/ChatView.tsx` adds a `voiceMode` boolean (`localStorage`-persisted). Off (default): mic input transcribes into the text field for the user to review/edit/send, matching Phase 0's original behavior — nothing is auto-sent or auto-spoken. On: a mic-driven message is sent immediately after transcription, and the reply is spoken aloud via `speak()` once it arrives — the same auto-speak also applies to typed messages while the toggle is on, so "voice mode" means one consistent thing (every reply is heard, not just mic-triggered ones) rather than two different behaviors depending on input method.

## Consequences

- The blast radius argument from ADR-0006 still holds: `create_file`/`create_folder` can only ever write inside two folders the user already owns and expects Omnira to touch, using a fixed allowlist the model cannot expand.
- A system prompt now exists at all — previously the model had zero persona or behavioral instruction beyond whatever tools were passed in. This is a meaningful behavior change for every existing conversation, not just new features.
- Voice mode being off by default preserves the exact pre-existing UX for anyone who hasn't opted in; enabling it changes both input (auto-send) and output (auto-speak) behavior together, by design — a user who wants transcript-review-before-send but no auto-speech (or vice versa) isn't supported as a separate combination in this phase.
- No new capability/permission was added for file creation — an already-granted `Capability.SystemControl` silently gains two more actions the next time this code ships. Acceptable because the onboarding copy for that capability ("open websites and apps... on your computer") already sets the expectation of file-system-adjacent action, but worth a permission-copy update if a future action needs a stronger warning (e.g. anything that deletes or overwrites).

## Alternatives Considered

- **A separate `Capability.FileSystem`** for file/folder creation — rejected for Phase 0: splitting "can touch your computer" into multiple prompts adds onboarding friction without a clear safety win, since both capabilities are equally scoped to a fixed allowlist. Revisit if a future action (delete, overwrite, read arbitrary files) needs materially different trust.
- **A dedicated translation/localization layer for Urdu** (separate model call, i18n string tables) — rejected as overkill for "the model should be able to converse in Roman Urdu when asked"; a system-prompt instruction is the right weight for a single bilingual behavior, not a full i18n system meant for UI chrome strings.
- **Voice mode always on whenever a mic permission is granted** (no separate toggle) — rejected: granting microphone access and wanting every single reply read aloud are different decisions: a user might want to speak a command by voice but still read the answer silently. The explicit toggle keeps those independent.
