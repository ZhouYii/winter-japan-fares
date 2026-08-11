/* Service worker for the Winter Japan Fares PWA.
 *
 * Strategy is deliberately asymmetric:
 *
 *   index.html  network-first  — a fare tracker that serves a cached page is
 *                                worse than one that fails, because a stale
 *                                price looks exactly like a current one. The
 *                                cache is only the offline fallback.
 *   everything  cache-first    — icons and the manifest never change.
 *
 * The cached copy is stamped, so an offline view can say how old it is rather
 * than pretending to be live.
 */
const CACHE = 'japan-fares-v1';
const SHELL = ['./icon-192.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isPage) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit ||
          new Response('<h1>Offline</h1><p>No cached copy of the fares page yet.</p>',
                       { headers: { 'Content-Type': 'text/html' } })))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
