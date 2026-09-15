const CACHE = 'athome-carcare-v13';
const ASSETS = [
  './', './index.html', './styles.css', './home-polish.css', './app.js', './supabase-integration.js', './manifest.webmanifest', './data/content.json',
  './icons/icon.svg', './assets/gv80-main.png.png?v=20260915-1',
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

async function withSupabaseIntegration(response) {
  if (!response) return response;
  const html = await response.text();
  if (html.includes('supabase-integration.js')) return new Response(html, response);
  const injected = html.replace('</body>', '  <script src="supabase-integration.js"></script>\n</body>');
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(injected, { status: response.status, statusText: response.statusText, headers });
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return withSupabaseIntegration(response);
        })
        .catch(async () => withSupabaseIntegration(await caches.match('./index.html')))
    );
    return;
  }

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
    }))
  );
});
