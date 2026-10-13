// Service worker Matoer: membuat aplikasi bisa dipasang (PWA) dan menampilkan
// halaman offline sederhana bila internet putus. Data selalu diambil dari server.
const CACHE = "matoer-v3";
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

// Push notification pengingat shift (dikirim server lewat Web Push)
self.addEventListener("push", (e) => {
  let d = { judul: "Matoer", isi: "", url: "/kasir" };
  try {
    d = { ...d, ...e.data.json() };
  } catch {}
  e.waitUntil(self.registration.showNotification(d.judul, { body: d.isi, icon: "/brand/logo-192.png", badge: "/brand/logo-192.png", data: { url: d.url }, tag: "pengingat-shift" }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/kasir";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
      const w = ws.find((c) => "focus" in c);
      return w ? w.focus().then(() => w.navigate(url)) : self.clients.openWindow(url);
    }),
  );
});
