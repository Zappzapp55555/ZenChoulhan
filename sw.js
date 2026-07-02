// v2 : cache-busting + stratégie "réseau d'abord" pour que les mises à jour de l'app
// soient toujours visibles immédiatement au lieu de rester bloquées sur une ancienne version en cache.
const CACHE = "cerveau-droit-v2";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Réseau d'abord : on essaie toujours de récupérer la dernière version en ligne.
// Si ça échoue (pas de connexion), on retombe sur la version en cache pour l'usage hors-ligne.
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((fresh) => {
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return fresh;
      })
      .catch(() => caches.match(e.request))
  );
});
