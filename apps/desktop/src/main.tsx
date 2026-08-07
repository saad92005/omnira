import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@omnira/ui-kit/tokens.css";
import { App } from "./App.js";

// Typography is the OS's own native UI font (system-ui / Segoe UI / San
// Francisco / Roboto, per platform — see --omnira-font-sans in tokens.css)
// rather than a bundled webfont, so no font imports here: nothing to load,
// nothing that can look "off-brand" from the rest of the user's system.

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root was not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA installability for the web build only — Tauri's webview runs on a
// custom scheme (tauri://, https://tauri.localhost) where a service worker
// registration is either meaningless or rejected, so this is a deliberate
// http(s)-only guard, not an oversight.
if (location.protocol.startsWith("http") && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Non-fatal: the app still works without offline caching, it just won't
    // be installable as a PWA in that case.
  });
}
