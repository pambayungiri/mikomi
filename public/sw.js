const CACHE = 'mikomi-v1'
const CHAPTER_CACHE = 'mikomi-chapters-v1'
const STATIC = ['/', '/list', '/bookmark', '/history', '/offline', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(STATIC.map(url => c.add(url).catch(() => {})))
    )
  )
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

// Cache chapter images + page HTML + API response when user saves a chapter
self.addEventListener('message', e => {
  if (e.data?.type !== 'CACHE_CHAPTER') return
  const urls = Array.isArray(e.data.urls) ? e.data.urls : []
  const chapterUrl = e.data.chapterUrl  // e.g. /chapter/slug/1
  const apiUrl = e.data.apiUrl          // e.g. /api/chapter/slug/1

  e.waitUntil(
    caches.open(CHAPTER_CACHE).then(cache =>
      Promise.all([
        // Cache manga page images (no-cors for cross-origin CDN images)
        ...urls.map(url =>
          cache.match(url).then(hit => {
            if (hit) return
            return fetch(url, { mode: 'no-cors' })
              .then(res => cache.put(url, res))
              .catch(() => {})
          })
        ),
        // Cache the chapter page HTML so it loads offline
        chapterUrl
          ? cache.match(chapterUrl).then(hit => {
              if (hit) return
              return fetch(chapterUrl)
                .then(res => { if (res.ok) return cache.put(chapterUrl, res) })
                .catch(() => {})
            })
          : Promise.resolve(),
        // Cache the API response so same-origin image URLs resolve offline
        apiUrl
          ? cache.match(apiUrl).then(hit => {
              if (hit) return
              return fetch(apiUrl)
                .then(res => { if (res.ok) return cache.put(apiUrl, res.clone()) })
                .catch(() => {})
            })
          : Promise.resolve(),
      ])
    )
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)

  // Cross-origin (CDN images): chapter cache first, then network
  if (url.hostname !== self.location.hostname) {
    e.respondWith(
      caches.open(CHAPTER_CACHE).then(cache =>
        cache.match(e.request).then(cached => cached ?? fetch(e.request))
      )
    )
    return
  }

  // Navigation requests (page loads)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => {
        // For saved chapters: try chapter cache first
        if (url.pathname.startsWith('/chapter/')) {
          return caches.open(CHAPTER_CACHE)
            .then(cache => cache.match(e.request))
            .then(cached => cached ?? caches.match('/offline') ?? caches.match('/'))
        }
        // For other pages: try static cache, then fall back to home
        return caches.match(e.request)
          .then(cached => cached ?? caches.match('/'))
      })
    )
    return
  }

  // Same-origin API + static assets: check both caches, then network (auto-cache on fetch)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return caches.open(CHAPTER_CACHE).then(chCache =>
        chCache.match(e.request).then(chCached => {
          if (chCached) return chCached
          return fetch(e.request).then(res => {
            if (!res.ok || res.status === 206) return res
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
            return res
          })
        })
      )
    })
  )
})
