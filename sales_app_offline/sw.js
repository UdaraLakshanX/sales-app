// sw.js - Offline Service Worker for Sales & Credit Manager PWA
const CACHE_NAME = 'sales-credit-pwa-v1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// 1. Install Event: Cache Core Static Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Service Worker] Pre-cache warning:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate Event: Clean Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event: Cache First with Dynamic Fallback & Network Fallback
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached resource immediately
                return cachedResponse;
            }

            // Otherwise, fetch from network and dynamically cache valid responses
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                    // Opaque CDN responses (like fonts or cross-origin stylesheets) can still be cached
                    if (networkResponse && (networkResponse.type === 'opaque' || networkResponse.status === 200)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // If offline and requesting page navigation, return index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
