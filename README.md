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
request from your phone (there's no "your Desktop" on a cloud container).
`SYSTEM_CONTROL_AVAILABLE=false` on the hosted deployment enforces this —
chat, conversation history, and voice all work the same either way, only
the automation actions are local-only.

**Deployment target: a single Netlify site, using Netlify Functions
instead of an always-on server.** Render and Railway both required a card
on this project's own account despite documenting card-free free tiers
(likely anti-abuse verification, industry-wide as of 2026 — see the
`render.yaml`/`railway.json` files still in the repo if you'd rather use
one of those and don't mind verifying a card). Netlify Functions sidestep
this: `apps/api/netlify/functions/api.ts` wraps the exact same Fastify app
(`buildServer()`) via `@fastify/aws-lambda` instead of calling `.listen()`,
so it runs as serverless functions on Netlify's free tier rather than a
persistent server — genuinely no card, verified by invoking the handler
locally against the real database before ever deploying it. One Netlify
site serves both the static web app and the API, so there's no second host
and no cross-host CORS dance.

1. [netlify.com](https://netlify.com) → sign up with GitHub → **Add new
   site → Import an existing project** → select the `omnira` repo. Netlify
   reads `netlify.toml` for the build command, publish directory, and
   function directory — nothing to configure by hand there.
2. In **Site settings → Environment variables**, add (same values as your
   local `apps/api/.env`): `NODE_ENV=production`,
   `SYSTEM_CONTROL_AVAILABLE=false`, `DATABASE_URL`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `GROQ_API_KEY`.
3. Deploy. Netlify assigns a URL like `https://omnira.netlify.app` (pick a
   custom subdomain in Site settings → Domain management if you want).
   `VITE_API_BASE_URL` is set automatically at build time to this same
   site's URL (`netlify.toml` bakes in Netlify's own `$URL` build variable)
   — no manual step for that one.
4. Add one more environment variable once you know the site's URL:
   `PUBLIC_WEB_ORIGIN` set to that same URL (e.g. `https://omnira.netlify.app`)
   — needed for the CORS allowlist even though frontend and API share an
   origin here. Trigger a redeploy after saving it (**Deploys → Trigger
   deploy**).
5. Open the site on a phone — from Chrome/Safari, "Add to Home Screen"
   installs it like a native app via the PWA manifest.

Function cold starts add roughly 1-2 seconds to the first request after a
period of inactivity — noticeably snappier than an always-on free tier's
15-minute-sleep wakeup, since only that one request pays the cost, not a
whole container spin-up.
