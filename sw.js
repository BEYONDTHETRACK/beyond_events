// La web app a déménagé dans ./app/ (elle y installe son propre service worker).
// Ce fichier remplace l'ancien service worker servi ici : il vide son cache et se désinscrit.
self.addEventListener('install', () => { self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url).catch(() => {})))
  )
})
