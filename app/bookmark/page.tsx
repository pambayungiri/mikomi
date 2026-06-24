'use client'

import { useState, useEffect } from 'react'
import MangaCard from '@/components/MangaCard'
import type { MangaCard as MangaCardType } from '@/lib/providers/types'

type BookmarkEntry = Pick<MangaCardType, 'slug' | 'name' | 'image' | 'type' | 'latestChapter'>

const KEY = 'mikomi_bookmarks'

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      setBookmarks(Array.isArray(data) ? data : [])
    } catch { setBookmarks([]) }
    setLoaded(true)
  }, [])

  function removeBookmark(slug: string) {
    const updated = bookmarks.filter(b => b.slug !== slug)
    localStorage.setItem(KEY, JSON.stringify(updated))
    setBookmarks(updated)
  }

  function clearAll() {
    localStorage.removeItem(KEY)
    setBookmarks([])
  }

  if (!loaded) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">Bookmarks</h1>
        {bookmarks.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-muted hover:text-accent-2 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <p className="text-muted text-center py-20 text-sm">No bookmarks yet. Start bookmarking manga!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {bookmarks.map(manga => (
            <div key={manga.slug} className="relative group/bookmark">
              <MangaCard manga={manga as MangaCardType} />
              <button
                onClick={() => removeBookmark(manga.slug)}
                className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover/bookmark:opacity-100 transition-opacity flex items-center justify-center"
                aria-label="Remove bookmark"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
