'use client'

import { useEffect } from 'react'
import { recordHistory } from '@/lib/storage'

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
    recordHistory({ slug, chapter, mangaName, mangaImage })
  }, [slug, chapter, mangaName, mangaImage])

  return null
}
