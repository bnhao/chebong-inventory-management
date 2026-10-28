// Chè Bông Inventory - PWA Service Worker
const CACHE_NAME = 'chebong-inventory-v1'

const PRECACHE_ASSETS = [
  '/',
  '/staff/dashboard',
  '/manifest.json',
  '/chebong-bowl.png',
  '/chebong-logo.png',
  '/icon.png',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
]

// 1. Install Event: Cache app shell & essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Pre-cache partial failure:', err)
      })
    })
  )
  self.skipWaiting()
})

// 2. Activate Event: Clean up old cache versions & take immediate control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// 3. Fetch Event: Intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET requests
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // Skip Supabase real-time and API calls to always ensure fresh data
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/rest/v1')) {
    return
  }

  // Next.js Server Actions or API routes -> Network only
  if (request.headers.get('next-action') || url.pathname.startsWith('/api/')) {
    return
  }

  // Strategy A: Next.js static bundles & media assets -> Cache-First with Network Revalidation
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background (Stale-While-Revalidate)
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse))
            }
          }).catch(() => {})
          return cachedResponse
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          }
          return networkResponse
        })
      })
    )
    return
  }

  // Strategy B: Navigation (HTML pages) -> Network-First, fallback to cached page or home
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          }
          return networkResponse
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse
          const fallback = await caches.match('/staff/dashboard')
          return fallback || caches.match('/')
        })
    )
    return
  }
})

