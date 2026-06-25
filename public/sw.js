const CACHE = 'mikomi-v1'
const CHAPTER_CACHE = 'mikomi-chapters-v1'
const STATIC = ['/', '/list', '/search', '/bookmark', '/history']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CHAPTER_CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Cache chapter images when the reader sends a CACHE_CHAPTER message
self.addEventListener('message', e => {
  if (e.data?.type !== 'CACHE_CHAPTER') return
  const urls = Array.isArray(e.data.urls) ? e.data.urls : []
  e.waitUntil(
    caches.open(CHAPTER_CACHE).then(cache =>
      Promise.all(
        urls.map(url =>
          cache.match(url).then(hit => {
            if (hit) return // already cached
            return fetch(url, { mode: 'no-cors' })
              .then(res => cache.put(url, res))
              .catch(() => {})
          })
        )
      )
    )
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Cross-origin: serve from chapter cache when available, otherwise network
  if (url.hostname !== self.location.hostname) {
    e.respondWith(
      caches.open(CHAPTER_CACHE).then(cache =>
        cache.match(e.request).then(cached => cached ?? fetch(e.request))
      )
    )
    return
  }

  // Network-first for navigation (always fresh HTML)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    )
    return
  }

  // Cache-first for same-origin static assets
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
