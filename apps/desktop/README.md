# Omnira Desktop (Phase 0)

Tauri v2 shell around a React/Vite frontend. The webview talks directly to
`apps/api` over HTTP — no custom Tauri commands yet (Phase 1's
desktop-bridge module adds those, behind the single OS-capability chokepoint
noted in `src-tauri/src/lib.rs`).

## Prerequisites (not installed in the environment this was built in)

1. **Rust toolchain** — `rustup` + a C++ build toolchain (on Windows: the
   Visual Studio Build Tools "Desktop development with C++" workload). See
   https://v2.tauri.app/start/prerequisites/. This repo's dev container did
   not have Rust installed, so the `src-tauri` Rust code has not been
   compiled or run — it follows the standard `create-tauri-app` v2 shape,
   but treat it as unverified until you build it once.
2. **App icons** — see `src-tauri/icons/README.md`; only needed for
   `tauri build`, not `tauri dev`.
3. `apps/api` running locally (see the repo root README) with
   `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` set if you want chat and voice to
   actually respond.

## Run

```sh
pnpm install
pnpm --filter @omnira/desktop tauri dev
```

Set `VITE_API_BASE_URL` (defaults to `http://localhost:4000/v1`) if the API
isn't running on the default port.
