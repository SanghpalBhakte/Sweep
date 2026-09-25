// =============================================================================
// Sweep - Progressive Web App, Cache Engine & Web Push Service Worker
// Version: 1.0.2
// Path: public/sw.js
// =============================================================================

const CACHE_VERSION = 'sweep-v1.0.2';
const SHELL_CACHE = `sweep-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `sweep-static-${CACHE_VERSION}`;
const MEDIA_CACHE = `sweep-media-${CACHE_VERSION}`;

const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE];

// Core essential static offline assets
const CORE_STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

// 1. Install Event — Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => {
        return cache.addAll(CORE_STATIC_ASSETS).catch((err) => {
          console.warn('[SW] Core pre-cache non-fatal error:', err);
        });
      })
      .then(() => {
        // Do not force skipWaiting automatically so user can control update prompt
      })
  );
});

// 2. Activate Event — Clean up obsolete cache versions immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('sweep-') && !CURRENT_CACHES.includes(cacheName)) {
              console.log('[SW] Deleting stale cache version:', cacheName);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Message Event — Support manual SKIP_WAITING from update banner
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch Routing Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Skip cross-origin non-assets, extensions, or Supabase Auth/REST/Callback calls (NetworkOnly)
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Strategy A: HTML Document Navigations -> NetworkFirst with offline cache fallback
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          const rootCached = await caches.match('/');
          if (rootCached) {
            return rootCached;
          }
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sweep (offline)</title><style>body{background:#F6F1E8;color:#24201E;font-family:system-ui,sans-serif;padding:32px;text-align:center}h1{font-family:Georgia,serif;font-size:24px;color:#5B294A}p{color:#756D65;font-size:14px;max-width:320px;margin:12px auto}</style></head><body><h1>Sweep</h1><p>You are offline. Connect to the internet to sync your subscriptions.</p></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // Strategy B: Immutable Next.js static JS/CSS and fonts -> CacheFirst with network fallback
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('api.fontshare.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Strategy C: Icons, Images, and Web App Manifest -> StaleWhileRevalidate
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/og-image.png' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(MEDIA_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// 5. Push Notification Handler
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    data = {
      title: 'Sweep Reminder',
      body: event.data.text() || 'You have an upcoming subscription renewal.',
    };
  }

  const title = data.title || 'Sweep Renewal Alert';
  const options = {
    body: data.body || 'A recurring subscription is scheduled to renew soon.',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'sweep-renewal-alert',
    data: {
      url: data.url || '/',
      subscriptionId: data.subscriptionId,
    },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 6. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
