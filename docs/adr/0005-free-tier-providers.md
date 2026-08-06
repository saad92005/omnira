# ADR-0005: Switch to Free-Tier Providers (Groq + Browser TTS)

- **Status:** Accepted
- **Date:** 2026-08-06
- **Deciders:** Project owner (explicit: "I don't want to add paid api keys"), Claude Code
- **Supersedes:** [ADR-0003](0003-llm-provider.md) (LLM provider), [ADR-0004](0004-stt-tts-vendor.md) (STT/TTS vendor)

## Context

ADR-0003 and ADR-0004 picked Anthropic Claude and OpenAI (Whisper + TTS) as
the Phase 0 chat and voice vendors. Both require a billed API key. The
project owner explicitly does not want to add paid API keys for this phase.
`packages/orchestrator`'s `ModelProvider` and `packages/voice`'s
`SttProvider` interfaces were designed vendor-agnostic for exactly this kind
of swap (ADR-0003's stated consequence), so this is an implementation swap
behind an existing interface, not an architecture change.

## Decision

**Chat: Groq**, via the official `openai` npm SDK pointed at Groq's
OpenAI-compatible endpoint (`baseURL: "https://api.groq.com/openai/v1"`,
confirmed against Groq's own docs at implementation time — see
`packages/orchestrator/src/groq-provider.ts`). Default model
`llama-3.3-70b-versatile`. Free tier, no card required
(`console.groq.com`), rate-limited but sufficient for Phase 0 development
and testing.

**Speech-to-text: Groq Whisper**, same account/API key as chat, via the
same OpenAI-compatible shape (`POST /audio/transcriptions`, multipart
`file` + `model`). Default model `whisper-large-v3-turbo` — chosen over
`whisper-large-v3` specifically for its higher free-tier rate limit;
`whisper-large-v3` remains available via the `model` option for higher
accuracy if the turbo variant's quality isn't sufficient.

**Text-to-speech: moved client-side entirely**, using the browser's native
`speechSynthesis` API in `apps/desktop` (`apps/desktop/src/speech.ts`). This
is not a vendor swap — it removes the server-side TTS vendor decision
altogether. No API key, no network call, no rate limit, works in Tauri's
Chromium-based webview (WebView2 on Windows, WebKitGTK on Linux). The
`/v1/voice/speak` endpoint and `packages/voice`'s `TtsProvider` interface
are removed rather than kept as unused abstraction.

## Consequences

- `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are gone from `packages/core`'s
  config schema, replaced by a single optional `GROQ_API_KEY` that covers
  both chat and STT.
- Model quality/behavior differs from Claude and OpenAI's Whisper — Groq
  hosts open models (Llama 3.3, etc.), not Claude. Acceptable for Phase 0's
  walking-skeleton goal; revisit with a new ADR if a later phase has a hard
  requirement Groq's free tier can't meet (e.g. tool-use quality for the
  Phase 2 multi-agent system).
- Free-tier rate limits apply (requests/tokens per minute, per day) — under
  heavy testing, `/v1/chat` and `/v1/voice/transcribe` can return 429s from
  Groq, surfaced as `UpstreamError` per the existing error-handling pattern.
  No retry/backoff logic was added for this in Phase 0.
- Spoken-reply voice/quality is now whatever the OS/webview ships (not
  chosen or controlled by Omnira), and playback quality can vary by
  platform — an accepted tradeoff for zero cost and zero vendor dependency.
- **Not independently verified against the live Groq API in this session**
  — the endpoint shapes were confirmed against Groq's current documentation
  at implementation time, and the code is unit-tested against a mocked SDK/
  fetch, but no real API key had been exercised end-to-end as of this ADR's
  acceptance. Same "implemented, not yet verified live" caveat as ADR-0003/
  0004 originally carried.

## Alternatives Considered

- **Google Gemini (AI Studio)** — also genuinely free, no card required, and
  arguably higher-quality outputs than Groq's hosted open models. Not
  chosen because Groq alone covers *both* chat and STT with a single key,
  where Gemini would still need a separate STT vendor (Gemini's own audio
  input works differently from a plain Whisper-style transcription
  endpoint). Worth reconsidering if Groq's free-tier rate limits prove too
  restrictive.
- **OpenRouter free models** — rejected: availability and quality of the
  `:free`-tagged models fluctuates more than Groq's stable free tier.
- **Keeping OpenAI/Anthropic and asking the user to pay** — rejected per
  explicit instruction.
