/* ============================================================
   Service Worker — CHAPS PWA
   Cache-first para el shell de la app; network-first para datos.
   ============================================================ */

const CACHE_NAME = "chaps-v2";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/v4.css",
  "./js/auth.js",
  "./js/data.js",
  "./js/app.js",
  "./js/combat-data.js",
  "./js/combat.js",
  "./js/simulador.js",
  "./js/biblioteca.js",
  "./js/combat-extra.js",
  "./assets/chaps-portrait.jpg",
  "./assets/dragon-bg.png",
  "./assets/dragon-gate.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/tokens/Goblin.jpg",
  "./assets/tokens/Bandit.jpg",
  "./assets/tokens/Wolf.jpg",
  "./assets/tokens/Dire-Wolf.jpg",
  "./assets/tokens/Wizard.jpg",
  "./assets/tokens/Red-Dragon.jpg",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API externa: siempre red, con fallback offline si existe en caché
  if (url.origin !== self.location.origin) {
    e.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Recursos locales: cache-first, luego red
  e.respondWith(
    caches.match(request).then((res) => {
      if (res) return res;
      return fetch(request).then((netRes) => {
        if (!netRes || netRes.status !== 200 || request.method !== "GET") return netRes;
        const clone = netRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return netRes;
      });
    })
  );
});
