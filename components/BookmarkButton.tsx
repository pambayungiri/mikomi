'use client'

import { useEffect, useState } from 'react'
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { BookmarkEntry } from '@/lib/storage'

export default function BookmarkButton({ manga }: { manga: BookmarkEntry }) {
  const [mounted, setMounted] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
    setBookmarked(entries.some(e => e.slug === manga.slug))
    setMounted(true)
  }, [manga.slug])

  function toggle() {
    const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
    const isBookmarked = entries.some(e => e.slug === manga.slug)
    const next = isBookmarked
      ? entries.filter(e => e.slug !== manga.slug)
      : [manga, ...entries]
    writeStorage(STORAGE_KEYS.bookmarks, next)
    setBookmarked(!isBookmarked)
  }

  if (!mounted) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-surface-2 text-muted w-full justify-center opacity-60 cursor-default"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        </svg>
        Favorite
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center ${
        bookmarked
          ? 'bg-accent text-white'
          : 'bg-surface-2 text-muted hover:bg-accent hover:text-white'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
      {bookmarked ? 'Favorited' : 'Favorite'}
    </button>
  )
}
