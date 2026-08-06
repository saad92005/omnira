# Changelog

All notable changes to this project will be documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Project governance scaffolding: `/CLAUDE_MASTER_PROMPT.md`,
  `/docs/PROJECT_INDEX.md`, ADR-0001 through ADR-0004.
- **Phase 0 (Foundation) — full implementation:**
  - Monorepo scaffold: pnpm workspaces + Turborepo, strict TypeScript,
    shared ESLint/Prettier config, `/docs/CONVENTIONS.md`.
  - `packages/core`: environment config loader, structured logger with
    correlation IDs, typed error hierarchy + REST error envelope, the
    capability permission model.
  - `apps/api`: Fastify REST API (`/v1`), Prisma + Postgres, JWT
    access/refresh-token auth with rotation, capability permission grants,
    a single-agent chat endpoint, and voice transcribe/speak endpoints.
  - `packages/orchestrator`: vendor-agnostic `ModelProvider` interface +
    `AnthropicProvider` (Claude, streamed).
  - `packages/agents`: `ConversationState` (explicit, inspectable) and
    `ChatAgent`, with every turn written to the activity log.
  - `packages/voice`: `SttProvider`/`TtsProvider` interfaces + OpenAI
    (Whisper + TTS) implementations.
  - `packages/ui-kit`: design tokens (`/docs/DESIGN_SYSTEM.md`) and
    `Button`/`MicButton`/`MessageBubble` components.
  - `apps/desktop`: Tauri v2 shell + React/Vite frontend — first-run
    onboarding (microphone permission), sign-in, and chat UI with
    push-to-talk voice.
  - `docker-compose.yml` for local Postgres.
  - Full regression suite (build, lint, typecheck, 51 unit tests) green.
