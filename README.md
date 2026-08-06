# Omnira

"One Intelligence. Infinite Possibilities." — see
[`CLAUDE_MASTER_PROMPT.md`](CLAUDE_MASTER_PROMPT.md) for the full product/technical
specification and [`docs/PROJECT_INDEX.md`](docs/PROJECT_INDEX.md) for current
status.

## Phase 0 quickstart

Prerequisites: Node.js ≥20, [pnpm](https://pnpm.io), a Postgres database
(either Docker locally, or a free hosted one — see below), and — only if you
want to build/run the desktop shell — a
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

**If `docker compose up` fails with "Virtualization support not detected"**
(common in VMs or on machines with virtualization disabled in
BIOS/UEFI — Docker Desktop cannot start at all in that case), skip Docker
entirely: sign up free at [console.neon.tech](https://console.neon.tech)
(no card), copy the connection string it gives you, and paste it as
`DATABASE_URL` in `apps/api/.env` instead of the local one. Everything else
is unchanged. This is exactly what got Phase 0 verified end-to-end in this
project's own build — see `docs/PROJECT_INDEX.md` Known Issues #1.

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

## Building a distributable app

`apps/desktop` is a Tauri app, so `tauri build` produces a real,
double-click-installable bundle for the platform you build it on:

```sh
pnpm --filter @omnira/desktop tauri build
```

This has been run and verified on Windows — built, installed, and launched
for real — producing two installers under
`apps/desktop/src-tauri/target/release/bundle/`:

- `nsis/Omnira_<version>_x64-setup.exe` — NSIS setup executable.
  **Recommended**: installs per-user (`%LOCALAPPDATA%\Omnira`), no admin
  rights needed, registers a normal Add/Remove Programs entry + uninstaller.
  Verified end to end: silent install (`/S`), launched the real window,
  clean uninstall via its own `uninstall.exe`.
- `msi/Omnira_<version>_x64_en-US.msi` — standard Windows Installer
  package. WiX's default MSI is a per-machine install, which requires
  running as administrator (`Error 1925` otherwise) — expected MSI
  behavior, not a build defect. Prefer the NSIS installer above unless you
  specifically need MSI for enterprise deployment tooling.

Either one installs Omnira as a normal Windows application (Start Menu
entry, uninstaller, the works) on any x64 Windows machine — no Node, Rust,
or dev tooling required on the target machine, since the Rust/WebView2
runtime is compiled in.

**macOS and Linux builds are not produced by this repo as-is** — Tauri
cross-compiles per host OS, so a `.dmg`/`.app` (macOS) or `.deb`/`.AppImage`
(Linux) bundle has to be built by running the same `tauri build` command on
a machine of that OS (or in CI with a matching runner, e.g. GitHub Actions'
`macos-latest`/`ubuntu-latest`). The frontend and backend are 100% portable
already (plain TypeScript/React/Node); only this native-bundle step is
platform-bound. There is no cross-platform Tauri build from a single
Windows machine.

The app still needs `apps/api` reachable at whatever URL it's configured to
call — see `apps/desktop/src/api-client.ts`'s base URL. For "download and
open on any device" to mean anything beyond a single machine, the API needs
to be deployed somewhere reachable from that device (a real host, not
`localhost`) before distributing the installer beyond your own machine —
see "Public deployment" below.

## Public deployment (mobile + any browser)

For Omnira to be reachable from a phone, two things need to be hosted
publicly instead of running on `localhost`: `apps/api` (the backend) and
the web build of `apps/desktop` (the same React app Vite already produces,
usable in any browser — no Tauri required — and installable to a home
screen via the PWA manifest added in `apps/desktop/public/`).

**There's no legitimate free custom domain anymore** (services that used to
offer this, like Freenom, were shut down for abuse) — what you get instead
is a real, free, HTTPS-secured subdomain from whichever host you deploy to
(e.g. `omnira-api.onrender.com`). That's a genuine working URL, not a
placeholder; a custom domain (`omnira.ai`) would mean buying one separately
from a registrar and pointing its DNS at the host, which is optional
polish, not required for it to work on a phone.

**Important — system control is disabled on any public deployment.** The
`open_app`/`open_url`/`create_file`/`create_folder` tools (ADR-0006/0007)
act on whatever machine `apps/api` runs on. That's meaningful when it's
your own PC; it would be actively wrong on a cloud server acting on a
request from your phone (there's no "your Desktop" on a Render container).
`render.yaml` sets `SYSTEM_CONTROL_AVAILABLE=false` for exactly this
reason — chat, conversation history, and voice all work the same either
way, only the automation actions are local-only.

Deployment target: [Render](https://render.com) (free web-service tier,
generally no card required for hobby use; free tier sleeps after 15 minutes
idle — the first request after a nap takes ~30-50s to wake up). `render.yaml`
at the repo root is a ready-to-use Render Blueprint covering both services.

1. Push this repo to GitHub (Render deploys from a connected repo — there's
   no card-free way to deploy without one).
2. On [render.com](https://render.com): **New → Blueprint**, select the
   repo. Render reads `render.yaml` and proposes both services
   (`omnira-api`, `omnira-web`).
3. Before the first deploy finishes, fill in `omnira-api`'s secrets in its
   dashboard's Environment tab — same values as your local `apps/api/.env`:
   `DATABASE_URL` (the same Neon connection string works — sharing it means
   the same accounts/conversations are reachable from both the desktop app
   and the phone), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GROQ_API_KEY`,
   and `PUBLIC_WEB_ORIGIN` set to `https://omnira-web.onrender.com` (Render
   URLs are `https://<service name>.onrender.com` — predictable from the
   `name:` in `render.yaml`, so this can be filled in immediately, no need
   to wait for `omnira-web`'s first deploy).
4. Once both services are live, `https://omnira-web.onrender.com` is the
   URL to open on a phone (or any device) — from Chrome/Safari, "Add to
   Home Screen" installs it like a native app via the PWA manifest.
