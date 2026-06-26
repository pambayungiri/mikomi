'use client'

import { useEffect, useState } from 'react'
import type { MangaCard } from '@/lib/providers/types'

type BookmarkEntry = Pick<MangaCard, 'slug' | 'name' | 'image' | 'type' | 'latestChapter'>

const KEY = 'mikomi_bookmarks'

function load(): BookmarkEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(entries: BookmarkEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export default function BookmarkButton({ manga }: { manga: BookmarkEntry }) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const entries = load()
    setBookmarked(entries.some(e => e.slug === manga.slug))
  }, [manga.slug])

  function toggle() {
    const entries = load()
    const isBookmarked = entries.some(e => e.slug === manga.slug)
    const next = isBookmarked
      ? entries.filter(e => e.slug !== manga.slug)
      : [manga, ...entries]
    save(next)
    setBookmarked(!isBookmarked)
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
