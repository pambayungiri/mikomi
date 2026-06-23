'use client'

import { useEffect } from 'react'

type HistoryEntry = {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
  timestamp: number
}

const KEY = 'mikomi_history'

export default function HistoryTracker({
  slug,
  chapter,
  mangaName,
  mangaImage,
}: {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
}) {
  useEffect(() => {
    try {
      const existing: HistoryEntry[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      const filtered = existing.filter(e => !(e.slug === slug && e.chapter === chapter))
      const updated: HistoryEntry[] = [
        { slug, chapter, mangaName, mangaImage, timestamp: Date.now() },
        ...filtered,
      ].slice(0, 100)
      localStorage.setItem(KEY, JSON.stringify(updated))
    } catch { /* ignore storage errors */ }
  }, [slug, chapter, mangaName, mangaImage])

  return null
}
