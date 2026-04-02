// sw.js  –  Thamaniya PWA Service Worker
// IMPORTANT: bump CACHE_NAME after every deployment to force cache refresh
const CACHE_NAME = 't8-v2';

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
      return self.skipWaiting();
    })
  );
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
// Strategy: network-only for Google Sheets API, cache-first for everything else
self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Always fetch live for Google Apps Script (cross-origin backend)
  if (url.indexOf('script.google.com') !== -1 ||
      url.indexOf('script.googleusercontent.com') !== -1) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Return structured offline response so apiGet/apiPost callers get null cleanly
        return new Response(JSON.stringify({ ok: false, msg: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for app shell (index.html, icons, manifest)
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(function(networkResponse) {
        if (!networkResponse || networkResponse.status !== 200 ||
            (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(function() {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
