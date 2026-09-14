const CACHE = 'athome-carcare-v3';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest', './data/content.json',
  './icons/icon.svg', './assets/hero.svg',
  './assets/wheel-before.svg', './assets/wheel-after.svg', './assets/body-before.svg', './assets/body-after.svg',
  './assets/interior-before.svg', './assets/interior-after.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/data/content.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./data/content.json', copy));
          return response;
        })
        .catch(() => caches.match('./data/content.json'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
