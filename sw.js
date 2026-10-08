// Offline support: always try the network first (so updates show up right away),
// and fall back to the cached copy when there's no signal.
// Only same-origin files are cached; the database and book search always go to the network.
const CACHE = 'bookclub-v1';
const SHELL = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'js/app.js', 'js/screens.js',
  'js/sheets.js', 'js/ui.js', 'js/util.js', 'js/store.js', 'js/seed.js', 'js/config.js',
  'vendor/preact-htm.js', 'vendor/supabase.js', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })
    .catch(() => caches.match(e.request)));
});
