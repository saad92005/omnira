# Omnira

"One Intelligence. Infinite Possibilities." — see
[`CLAUDE_MASTER_PROMPT.md`](CLAUDE_MASTER_PROMPT.md) for the full product/technical
specification and [`docs/PROJECT_INDEX.md`](docs/PROJECT_INDEX.md) for current
status.

## Phase 0 quickstart

Prerequisites: Node.js ≥20, [pnpm](https://pnpm.io), Docker (for local
Postgres), and — only if you want to build/run the desktop shell — a
[Rust toolchain](https://v2.tauri.app/start/prerequisites/).

```sh
pnpm install

# 1. Database
docker compose up -d db
cp apps/api/.env.example apps/api/.env   # then fill in the secrets — see below
pnpm --filter @omnira/api prisma:migrate

# 2. Backend
pnpm --filter @omnira/api dev            # http://localhost:4000

# 3. Desktop app (separate terminal)
pnpm --filter @omnira/desktop tauri dev
```

### Required secrets (`apps/api/.env`)

| Variable | Required for | Where to get it |
|---|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Auth (always) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — run twice, once per secret |
| `GROQ_API_KEY` | `/v1/chat` (text chat) and `/v1/voice/transcribe` | Free, no card required: [console.groq.com](https://console.groq.com) (ADR-0005) |

Spoken replies use the desktop app's built-in browser `speechSynthesis` —
no key, no server call. Everything else (auth, permissions, health) works
with no external API keys at all.

## Repository layout

```
/apps
  /api        REST backend (Fastify + Prisma)
  /desktop    Desktop companion (Tauri + React)
/packages
  /core           shared types, config, logger, errors, permission model
  /agents         ChatAgent, conversation state, activity log
  /orchestrator   vendor-agnostic LLM provider interface + Groq impl
  /voice          STT provider interface + Groq (Whisper) impl
  /ui-kit         design tokens + shared React components
/docs
  PROJECT_INDEX.md   current state — read this first
  /adr               architecture decision records
  /features          per-phase feature specs
```

## Common commands (run from the repo root)

```sh
pnpm build       # build every package (Turborepo, cached)
pnpm lint        # eslint everywhere
pnpm typecheck   # tsc --noEmit everywhere
pnpm test        # unit tests everywhere (no external services needed)
```

`apps/api` also has `pnpm --filter @omnira/api test:integration`, which
exercises the real HTTP + Postgres stack — requires the database from step 1
above and a migrated schema.
