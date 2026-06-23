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
            className="text-sm text-muted hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <p className="text-muted text-center py-20 text-sm">No bookmarks yet. Start bookmarking manga!</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {bookmarks.map(manga => (
            <MangaCard
              key={manga.slug}
              manga={manga as MangaCardType}
            />
          ))}
        </div>
      )}
    </div>
  )
}
