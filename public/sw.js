// Service worker Matoer: membuat aplikasi bisa dipasang (PWA) dan menampilkan
// halaman offline sederhana bila internet putus. Data selalu diambil dari server.
const CACHE = "matoer-v2";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/brand/logo-192.png", "/mascot/404.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
  } else if (new URL(e.request.url).pathname === "/mascot/404.png") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/mascot/404.png")));
  }
});
