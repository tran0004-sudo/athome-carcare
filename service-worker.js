const CACHE = 'athome-carcare-v246';
const ASSETS = [
  './', './index.html', './manifest.webmanifest?v=20261001-icon7', './data/content.json',
  './core.css?v=20261022-stairs2', './features.css?v=20261024-homeback',
  './prices.js?v=20261024-van2', './app.js?v=20261024-van2', './supabase-integration.js?v=20261024-van2', './features.js?v=20261024-apt',
  './icons/icon-192.png?v=20261001-icon7', './icons/icon-512.png?v=20261001-icon7', './icons/icon-maskable-512.png?v=20261001-icon7',
  './privacy.html', './price.html'
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
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => (await caches.match(event.request, { ignoreSearch: true })) || caches.match('./index.html'))
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

  if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/icons/icon.svg') || url.pathname.includes('/icons/icon-')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
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

/* 알림 클릭 시 앱 열기 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (client.url.includes(self.registration.scope)) return client.focus();
    }
    return self.clients.openWindow((event.notification.data && event.notification.data.url) || './');
  })());
});

/* 서버 푸시 수신 — 앱이 꺼져 있어도 동작합니다 */
self.addEventListener('push', (event) => {
  let data = { title: '새 예약이 접수되었습니다', body: '관리자 화면에서 확인해주세요.' };
  try { if (event.data) data = { ...data, ...event.data.json() }; }
  catch { if (event.data) data.body = event.data.text(); }

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'ahc-reservation',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
  }));
});
