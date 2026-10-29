/* ============================================================
   Service Worker — CHAPS PWA
   Cache-first para el shell de la app; network-first para datos.
   ============================================================ */

const CACHE_NAME = "chaps-v11-daily-versions-battlefield";
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css?v=4",
  "./css/v4.css?v=18",
  "./css/features.css?v=2",
  "./css/combat-visuals.css?v=1",
  "./js/auth.js?v=5",
  "./js/data.js?v=5",
  "./js/app.js?v=9",
  "./js/combat-data.js?v=4",
  "./js/combat.js?v=9",
  "./js/simulador.js?v=4",
  "./js/biblioteca.js?v=4",
  "./js/combat-extra.js?v=5",
  "./js/cloud-core.js?v=4",
  "./js/profile-store.js?v=1",
  "./js/account-auth.js?v=1",
  "./js/features.js?v=2",
  "./js/firebase-sync.js?v=5",
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
const FIREBASE_SDK = ["firebase-app", "firebase-auth", "firebase-firestore"]
  .map((name) => "https://www.gstatic.com/firebasejs/13.1.0/" + name + ".js");

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(SHELL);
      // CDN opcional: un fallo no impide instalar la ficha local.
      await Promise.allSettled(FIREBASE_SDK.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
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

  // Navegación online siempre actualizada; copia instalada solo como fallback offline.
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    e.respondWith(fetch(request).then((response) => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      const copy = response.clone();
      e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  // Conservar SDK ya descargado para abrir la ficha instalada sin red.
  if (url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/") && request.method === "GET") {
    e.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      }
      return response;
    })));
    return;
  }

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
