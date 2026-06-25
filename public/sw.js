const CACHE = 'mikomi-v1'
const STATIC = ['/', '/list', '/search', '/bookmark', '/history']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Skip Firestore API and external origins
  if (url.hostname !== self.location.hostname) return

  // Network-first for navigation (always fresh HTML)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    )
    return
  }

  // Cache-first for static assets (_next/static, images, etc.)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (!res.ok || res.status === 206) return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
        return res
      })
    })
  )
})
