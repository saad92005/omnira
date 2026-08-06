// Minimal app-shell cache — just enough for "Add to Home Screen"
// installability and a usable offline reload if the network is truly down.
//
// Network-first for everything, falling back to cache only on failure. This
// was cache-first before, and it caused a real bug: the HTML document
// references content-hashed JS/CSS filenames that change on every deploy,
// so once a visitor's browser cached an old "/" response, it kept serving
// that stale HTML forever — pointing at a script filename that no longer
// existed after the next deploy, so the page loaded to a blank white screen
// with a 404 in the console. Network-first means a visitor always gets the
// current deploy while online; the cache only matters if they're offline.
const CACHE_NAME = "omnira-shell-v2";
const SHELL_ASSETS = ["/manifest.webmanifest", "/icon-128.png", "/icon-512.png"];

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
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
