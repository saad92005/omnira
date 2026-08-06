# ADR-0004: STT/TTS Vendor for the Phase 0 Basic Voice Loop

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Claude Code (technical lead)
- **Supersedes:** none

## Context

Phase 0.5 needs a single-utterance STT call and a TTS call behind the voice
pipeline (master prompt §6, deliberately reduced scope per
`docs/features/phase-0-foundation.md` — no wake word, no streaming, no
barge-in yet). `packages/voice` needs one concrete vendor behind its provider
interfaces to be a real, testable walking skeleton rather than an empty
abstraction.

## Decision

**OpenAI, via its REST API (Whisper transcription + TTS endpoints), called
with plain `fetch` — no SDK dependency.**

- `SttProvider.transcribe(audio, mimeType)` → `POST
  https://api.openai.com/v1/audio/transcriptions` (model `whisper-1`),
  multipart audio upload, returns transcribed text.
- `TtsProvider.synthesize(text)` → `POST
  https://api.openai.com/v1/audio/speech` (model `tts-1`), returns audio
  bytes.
- Single vendor, single API key (`OPENAI_API_KEY`), REST-only — no new SDK
  dependency in `packages/voice`; `fetch` is available natively in Node 20+.
  This keeps the package's dependency footprint minimal for a feature that is
  explicitly a reduced Phase 0 slice.
- Both providers sit behind the same `SttProvider`/`TtsProvider` interfaces
  as `packages/orchestrator`'s `ModelProvider` (ADR-0003) — a second vendor
  can be swapped in later without touching `packages/voice`'s pipeline logic
  or `apps/desktop`.

## Consequences

- A second API key (`OPENAI_API_KEY`, distinct from `ANTHROPIC_API_KEY`) is
  required to exercise voice end to end. `packages/core`'s config loader
  treats it as optional, the same way `ANTHROPIC_API_KEY` is optional — the
  rest of the system (text chat, auth, permissions) works without it, and
  the voice pipeline fails loudly with a clear "voice requires
  OPENAI_API_KEY" error rather than crashing the process.
- **Not independently verified against the live OpenAI API in this session**
  — no audio hardware or network credentials are available in this
  environment. The HTTP request/response shape is implemented from OpenAI's
  documented API contract and unit-tested against a mocked `fetch`; the user
  must supply `OPENAI_API_KEY` and do one real end-to-end test (push-to-talk
  → transcript → reply → spoken audio) before relying on this in Phase 0's
  definition of done (`docs/features/phase-0-foundation.md` §0.7).
- No on-device/local STT or TTS in Phase 0 — every voice turn requires
  network connectivity, consistent with the reduced-scope acceptance
  criteria in §0.5 ("no network → clear message, not silent failure").
  Revisit local-first voice (whisper.cpp, a local TTS model) only if it
  becomes a real Phase 0 requirement rather than a nice-to-have.

## Alternatives Considered

- **Deepgram (STT) + ElevenLabs (TTS)** — likely better latency and voice
  quality, but two vendors means two API keys and two client integrations
  for a Phase 0 slice that's explicitly meant to be minimal. Worth
  revisiting when the full §6 voice spec (streaming STT, wake word,
  barge-in) is built out — Deepgram's streaming API in particular is a
  better fit for that than OpenAI's file-upload Whisper endpoint.
- **Local Whisper (whisper.cpp) + a local TTS model** — rejected for Phase
  0: better for the "local-first" principle in §4.5, but adds a real
  packaging/runtime dependency (model files, native binaries) to a phase
  whose goal is a thin walking skeleton. A natural Phase 1+ addition once
  desktop-bridge exists to manage local model assets.
