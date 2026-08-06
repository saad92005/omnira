No icon files are checked in yet — this session had no source artwork to
generate them from. Before running `pnpm tauri build` (a full bundle;
`pnpm tauri dev` does not require icons), generate the full icon set from a
1024x1024 PNG:

```
pnpm --filter @omnira/desktop exec tauri icon path/to/logo.png
```

That populates this directory with `32x32.png`, `128x128.png`,
`128x128@2x.png`, `icon.icns`, and `icon.ico` — the exact files
`tauri.conf.json`'s `bundle.icon` list expects.
