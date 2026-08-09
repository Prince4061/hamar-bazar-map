// Hamar Bazar Rider PWA Service Worker
const CACHE_NAME = 'rider-gps-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Network first strategy
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
