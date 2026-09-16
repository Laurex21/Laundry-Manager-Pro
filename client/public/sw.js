const CACHE_NAME = "xpresspro-shell-v1";
const STATIC_SHELL = [
  "/manifest.webmanifest", "/pwa-192.png", "/pwa-512.png",
  "/pwa-maskable-512.png", "/apple-touch-icon.png", "/xpresspro-mark.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Authenticated navigations and API data must always come from the network.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request));
    return;
  }
  if (!STATIC_SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
