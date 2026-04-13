// TruckZen Service Worker — offline support ONLY.
// We deliberately do NOT cache JS/CSS/navigation so deploys take effect
// immediately. Browser HTTP cache + Next.js' hashed asset filenames handle
// revalidation correctly on their own; our previous stale-while-revalidate
// strategy was serving mixed old+new chunks across deploys.
const CACHE_NAME = 'truckzen-v4'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: delete ALL non-current caches, then claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  )
})

// Fetch: only hijack requests we have a specific reason to serve from cache.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return

  // Navigation requests: network-only, fall back to offline page if offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL) || Response.error())
    )
    return
  }

  // Precached static icons/manifest: serve from cache.
  if (PRECACHE_URLS.some((u) => url.pathname === u)) {
    event.respondWith(caches.match(request).then((r) => r || fetch(request)))
    return
  }

  // Everything else (JS, CSS, fonts, images, API): fall through to default.
  // Letting the browser's normal HTTP cache handle it means Next.js' hashed
  // chunk filenames always produce a fresh load after deploy.
})
