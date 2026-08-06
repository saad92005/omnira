// Minimal app-shell cache — just enough for "Add to Home Screen" installability
// and a usable offline reload. Chat/voice themselves always need the network
// (they talk to apps/api), this only keeps the shell from going blank.
const CACHE_NAME = "omnira-shell-v1";
const SHELL_ASSETS = ["/", "/manifest.webmanifest", "/icon-128.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).catch(() => cached)),
  );
});
