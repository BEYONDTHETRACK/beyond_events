// Service worker minimal : rend l'app installable et garde la coquille hors ligne.
// Les données (Supabase) passent toujours par le réseau.
const CACHE = 'be-shell-v1'
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  // Réseau d'abord, cache en secours.
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy))
      return res
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./')))
  )
})
