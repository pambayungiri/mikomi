'use server'

import { getProvider } from '@/lib/providers'
import type { MangaCard } from '@/lib/providers/types'

export async function fetchMoreManga(opts: {
  genre?: string
  sort?: string
  type?: string
  after?: string
}): Promise<{ data: MangaCard[]; nextCursor: string | null; hasMore: boolean }> {
  const provider = getProvider()
  const validSort = opts.sort === 'create' || opts.sort === 'rating' ? opts.sort : opts.sort === 'update' ? 'update' : undefined
  return provider.getList({
    genre: opts.genre,
    sort: validSort,
    type: opts.type,
    after: opts.after,
  })
}
