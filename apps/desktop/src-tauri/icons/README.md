These icons are a placeholder — generated from a simple brand-accent-colored
circle (`#5B5BD6`, from `/docs/DESIGN_SYSTEM.md`), not real Omnira artwork.
They exist so `cargo build`/`tauri build` actually succeed (Tauri's Windows
resource step requires `icon.ico` to be present even for a debug build).

To replace with real artwork later, regenerate the full set from a
1024x1024 PNG:

```
pnpm --filter @omnira/desktop exec tauri icon path/to/real-logo.png
```

Only the desktop-target output is kept here (`32x32.png`, `64x64.png`,
`128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns`, `icon.ico`) — the
`tauri icon` command also generates Android/iOS/Windows-Store variants by
default; delete those again after regenerating unless a mobile or Store
target is actually added.
