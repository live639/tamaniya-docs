// sw.js  –  Thamaniya PWA Service Worker
// IMPORTANT: bump CACHE_NAME after every deployment to force cache refresh
const CACHE_NAME = 't8-v17';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      // فعّل الـSW الجديد فوراً بدون انتظار دورة client — يعيد سلوك v7 السريع
      return self.skipWaiting();
    })
  );
});

// ── MESSAGE ──────────────────────────────────────────────────────────────────
// Allow client to force skipWaiting for immediate update
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
// Strategy: network-first to ensure updates load immediately (critical for iOS)
self.addEventListener('fetch', function(event) {
  // تجاهل الطلبات عبر النطاقات (Firebase APIs, gstatic CDN) — نخليها لكاش المتصفح
  var reqUrl;
  try { reqUrl = new URL(event.request.url); } catch(e) { return; }
  if (reqUrl.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  // لطلبات المستندات (index.html / navigation)، نعيد بناء الطلب مع cache:'reload'
  // حتى لا يقدّم المتصفح نسخة HTTP-cached قديمة بدلاً من الطازج. هذا يجعل
  // "network-first" فعلياً بدون استخدام الكاش المخفي للـHTTP في المنتصف.
  var req = event.request;
  if (req.destination === 'document' || req.mode === 'navigate') {
    req = new Request(req, { cache: 'reload' });
  }

  event.respondWith(
    fetch(req).then(function(networkResponse) {
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
