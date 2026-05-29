// ══════════════════════════════════════════════════════════
//  মেস মিল ট্র্যাকার — sw.js (Service Worker)
//  Cache strategy: Network First for JS/API, Cache First for assets
// ══════════════════════════════════════════════════════════

const CACHE_VERSION = 'mm-v3.0.0';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// ── Static assets to pre-cache ────────────────────────────
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
];

// ── Install: pre-cache static assets ──────────────────────
self.addEventListener('install', event => {
  self.skipWaiting(); // নতুন SW সাথে সাথে active হবে
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache failed:', err);
      });
    })
  );
});

// ── Activate: পুরনো cache পরিষ্কার করো ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('mm-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Network First strategy ─────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase API, Google Auth, Google Fonts — always network, no cache
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('firebase.google.com') ||
    event.request.method !== 'GET'
  ) {
    return; // browser handle করবে
  }

  // HTML pages: Network First (offline fallback)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // JS/CSS/Fonts: Cache First (fast load, background update)
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => null);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Images: Cache First
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/) ||
    url.hostname.includes('lh3.googleusercontent.com') // Google avatar
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // Default: Network with runtime cache fallback
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Background Sync (future feature placeholder) ──────────
self.addEventListener('sync', event => {
  if (event.tag === 'mm-sync-meals') {
    console.log('[SW] Background sync: meals');
  }
});

// ── Push Notifications (future feature placeholder) ───────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'মেস মিল ট্র্যাকার', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'mm-notification',
      data: data.url || './'
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || './')
  );
});
