const CACHE = 'athome-carcare-v80';
const ASSETS = [
  './', './index.html', './styles.css?v=20260916-1line', './home-polish.css?v=20260916-nohero1', './restore-classic.js?v=20260916-2', './compat-fix.js?v=20260916-3', './app.js?v=20260924-blogsync1', './supabase-integration.js?v=20260921-stats1', './manifest.webmanifest?v=20260919-icon5', './data/content.json',
'./icons/icon-192.png?v=20260919-icon5', './icons/icon-512.png?v=20260919-icon5', './icons/icon-maskable-512.png?v=20260919-icon5',
  './assets/partner-recruit.jpg?v=20260919', './assets/wheel-before.svg', './assets/wheel-after.svg', './assets/body-before.svg', './assets/body-after.svg',
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
  let html = await response.text();

  html = html
    .replaceAll('manifest.webmanifest?v=20260915-7', 'manifest.webmanifest?v=20260919-icon5')
    .replaceAll('icons/icon.svg?v=20260915-7', 'icons/icon-192.png?v=20260919-icon5');

  if (!html.includes('compat-fix.js')) {
    if (html.includes('<script src="restore-classic.js')) {
      html = html.replace('<script src="restore-classic.js', '<script src="compat-fix.js?v=20260916-3"></script>\n  <script src="restore-classic.js');
    } else if (html.includes('<script src="app.js')) {
      html = html.replace('<script src="app.js', '<script src="compat-fix.js?v=20260916-3"></script>\n  <script src="app.js');
    } else {
      html = html.replace('</body>', '  <script src="compat-fix.js?v=20260916-3"></script>\n</body>');
    }
  }

  if (!html.includes('supabase-integration.js')) {
    html = html.replace('</body>', '  <script src="supabase-integration.js"></script>\n</body>');
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
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
