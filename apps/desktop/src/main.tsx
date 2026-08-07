import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/700.css";
import "@omnira/ui-kit/tokens.css";
import { App } from "./App.js";

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
