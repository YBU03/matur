// Service worker Matoer: membuat aplikasi bisa dipasang (PWA) dan menampilkan
// halaman offline sederhana bila internet putus. Data selalu diambil dari server.
const CACHE = "matoer-v6";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll([OFFLINE, "/brand/logo-192.png", "/mascot/404.png"]);
      // Only this public, data-free shell is saved. Personal pages stay network-only.
      const shell = await fetch("/pos-offline", { cache: "reload" });
      if (!shell.ok) throw new Error("Offline shell unavailable");
      const html = await shell.clone().text();
      await c.put("/pos-offline", shell);
      const assets = [
        ...new Set(
          [
            ...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g),
          ].map((m) => m[1]),
        ),
      ];
      await c.addAll(assets);
    })(),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== "GET") return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(async () => {
        if (url.pathname === "/kasir/pos" || url.pathname === "/pos-offline") {
          const shell = await caches.match("/pos-offline");
          if (shell) return shell;
        }
        return caches.match(OFFLINE);
      }),
    );
  } else if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then(async (response) => {
            if (response.ok)
              await (await caches.open(CACHE)).put(e.request, response.clone());
            return response;
          }),
      ),
    );
  } else if (url.pathname === "/mascot/404.png") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/mascot/404.png")),
    );
  }
});

// Push notification pengingat shift (dikirim server lewat Web Push)
self.addEventListener("push", (e) => {
  let d = { judul: "Matoer", isi: "", url: "/kasir" };
  try {
    d = { ...d, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(d.judul, {
      body: d.isi,
      icon: "/brand/logo-192.png",
      badge: "/brand/logo-192.png",
      data: { url: d.url },
      tag: "pengingat-shift",
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/kasir";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((ws) => {
        const w = ws.find((c) => "focus" in c);
        return w
          ? w.focus().then(() => w.navigate(url))
          : self.clients.openWindow(url);
      }),
  );
});
