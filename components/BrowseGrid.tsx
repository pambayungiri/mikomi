'use client'

import { useState, useTransition } from 'react'
import type { MangaCard } from '@/lib/providers/types'
import MangaCardComp from './MangaCard'
import { fetchMoreManga } from '@/app/list/actions'

interface Props {
  initialData: MangaCard[]
  initialHasMore: boolean
  initialCursor: string | null
  genre?: string
  sort?: string
  type?: string
  showLoadMore: boolean
}

export default function BrowseGrid({ initialData, initialHasMore, initialCursor, genre, sort, type, showLoadMore }: Props) {
  const [items, setItems] = useState(initialData)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [cursor, setCursor] = useState(initialCursor)
  const [pending, startTransition] = useTransition()

  function loadMore() {
    startTransition(async () => {
      const result = await fetchMoreManga({ genre, sort, type, after: cursor ?? undefined })
      setItems(prev => {
        const ids = new Set(prev.map(m => m.id))
        return [...prev, ...result.data.filter(m => !ids.has(m.id))]
      })
      setHasMore(result.hasMore)
      setCursor(result.nextCursor)
    })
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {items.map(manga => (
          <MangaCardComp key={manga.id} manga={manga} />
        ))}
      </div>

      {showLoadMore && hasMore && cursor && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMore}
            disabled={pending}
            className="px-6 py-2 rounded-full bg-surface-2 text-muted hover:bg-accent hover:text-white transition-colors text-sm font-medium disabled:opacity-50"
          >
            {pending ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </>
  )
}
