'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { MangaCard as MangaCardType } from '@/lib/providers/types'

type BookmarkEntry = Pick<MangaCardType, 'slug' | 'name' | 'image' | 'type' | 'latestChapter'>

const KEY = 'mikomi_bookmarks'
const HISTORY_KEY = 'mikomi_history'

type LastReadMap = Record<string, number>

const TYPE_COLOR: Record<string, string> = {
  Manga: 'bg-accent',
  Manhwa: 'bg-accent-2',
  Manhua: 'bg-gold text-black',
}

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([])
  const [lastRead, setLastRead] = useState<LastReadMap>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      setBookmarks(Array.isArray(data) ? data : [])

      const history: { slug: string; chapter: number }[] = JSON.parse(
        localStorage.getItem(HISTORY_KEY) ?? '[]'
      )
      const map: LastReadMap = {}
      for (const entry of history) map[entry.slug] = entry.chapter
      setLastRead(map)
    } catch {
      setBookmarks([])
    }
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

  if (!loaded) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-[2/3] rounded-lg bg-surface-2 animate-pulse" />
          <div className="mt-1.5 h-3 rounded bg-surface-2 animate-pulse" />
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">
          Bookmarks
          {bookmarks.length > 0 && (
            <span className="text-sm font-normal text-muted ml-2">({bookmarks.length})</span>
          )}
        </h1>
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
        <div className="text-center py-20">
          <p className="text-muted text-sm">No bookmarks yet.</p>
          <Link href="/list" className="text-accent text-sm mt-3 inline-block hover:underline">
            Browse manga →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {bookmarks.map(manga => {
            const chapter = lastRead[manga.slug]
            return (
              <div key={manga.slug} className="relative group">
                {/* Card */}
                <Link href={`/manga/${manga.slug}`} className="block">
                  <div className="relative overflow-hidden rounded-lg bg-surface aspect-[2/3]">
                    <Image
                      src={manga.image}
                      alt={manga.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 160px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                    <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${TYPE_COLOR[manga.type] ?? 'bg-muted'}`}>
                      {manga.type}
                    </span>
                    {/* Remove button — always visible */}
                    <button
                      onClick={e => { e.preventDefault(); removeBookmark(manga.slug) }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-accent-2/80 transition-colors z-10"
                      aria-label="Remove bookmark"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <h3 className="mt-1.5 text-xs font-semibold text-fg line-clamp-2 leading-tight">{manga.name}</h3>
                  {manga.latestChapter !== null && (
                    <p className="text-[10px] text-muted mt-0.5">Ch. {manga.latestChapter}</p>
                  )}
                </Link>

                {/* Continue reading button */}
                {chapter !== undefined && (
                  <Link
                    href={`/chapter/${manga.slug}/${chapter}`}
                    className="mt-1.5 flex items-center justify-center gap-1 w-full py-1 rounded bg-accent/10 text-accent text-[10px] font-medium hover:bg-accent/20 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Ch. {chapter}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
