/* Offline copy of the Training Tracker.
   To release an update: raise VERSION here and CONFIG.appVersion in index.html, then push.
   Phones download the new files in the background and the app offers "Update now". */
const VERSION = "2026-10-26.1";
const CACHE = "training-tracker-" + VERSION;
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(f => new Request(f, {cache: "reload"})))));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("training-tracker-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", event => { if (event.data === "skip-waiting") self.skipWaiting(); });

// Saved copy first, so the app opens instantly with or without signal.
// Page loads fall back to the saved index.html.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith(caches.open(CACHE).then(cache =>
    cache.match(req, {ignoreSearch: true}).then(hit => hit ||
      fetch(req).catch(() => req.mode === "navigate" ? cache.match("index.html") : Response.error()))));
});
