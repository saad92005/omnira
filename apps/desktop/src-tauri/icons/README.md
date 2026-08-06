This is real Omnira artwork now — a glossy gradient sphere (cyan → violet →
magenta, matching the app's Aurora accent gradient) inside a segmented
instrument ring, echoing the voice orb that's the app's actual centerpiece.
Hand-crafted as an SVG (not a stock/purchased asset) and rasterized to the
full icon set below.

To regenerate from an updated master image (1024x1024 PNG):

```
pnpm --filter @omnira/desktop exec tauri icon path/to/new-icon.png
```

Only the desktop-target output is kept here (`32x32.png`, `64x64.png`,
`128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns`, `icon.ico`) — the
`tauri icon` command also generates Android/iOS/Windows-Store variants by
default; delete those again after regenerating unless a mobile or Store
target is actually added. `apps/desktop/public/icon-128.png` and
`icon-512.png` (the PWA manifest's icons) should be copied from `128x128.png`
and `icon.png` respectively whenever this set is regenerated, so the web
build's icon matches the desktop app's.
