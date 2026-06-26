'use client'

import { useEffect } from 'react'
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { HistoryEntry } from '@/lib/storage'

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
    const existing = readStorage<HistoryEntry[]>(STORAGE_KEYS.history, [])
    const filtered = existing.filter(e => !(e.slug === slug && e.chapter === chapter))
    const updated: HistoryEntry[] = [
      { slug, chapter, mangaName, mangaImage, timestamp: Date.now() },
      ...filtered,
    ].slice(0, 100)
    writeStorage(STORAGE_KEYS.history, updated)
  }, [slug, chapter, mangaName, mangaImage])

  return null
}
