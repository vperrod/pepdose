// MUST be bumped with every shipped fix: installed PWAs only reinstall the SW (and drop stale caches) when sw.js bytes change — an unbumped deploy leaves devices on the old build.
const CACHE_NAME = 'pepdose-v11-' + Date.now();
const BASE = '/pepdose/';
const STATIC_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Focus (or open) the app when a dose reminder is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && target) client.navigate(target).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cross-origin (e.g. Supabase API) responses carry dose/health data and must
  // never enter the cache — they'd survive logout. Let the browser handle them.
  if (url.origin !== self.location.origin) return;

  // For navigation requests (SPA routes), serve index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(BASE + 'index.html'))
        .then((r) => r || caches.match(BASE + 'index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Never cache errors: a stored 404/500 would be served on later
        // offline/network-fail requests.
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match(BASE)))
  );
});
