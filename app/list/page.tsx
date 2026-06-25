import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import GenreFilter from '@/components/GenreFilter'
import Link from 'next/link'

export const revalidate = 3600

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; sort?: string; type?: string; after?: string }>
}) {
  const { genre, sort, type, after } = await searchParams
  const provider = getProvider()
  const genres = provider.getGenres()

  const validSort = sort === 'create' || sort === 'rating' ? sort : sort === 'update' ? 'update' : undefined

  const { data, nextCursor, hasMore } = await provider.getList({
    genre,
    sort: validSort,
    type,
    after,
  })

  const nextParams = new URLSearchParams()
  if (genre) nextParams.set('genre', genre)
  if (sort) nextParams.set('sort', sort)
  if (type) nextParams.set('type', type)
  if (nextCursor) nextParams.set('after', nextCursor)

  const isFiltered = !!(genre || sort || type)

  return (
    <div>
      <h1 className="text-xl font-bold text-fg mb-4">Browse</h1>
      <Suspense>
        <GenreFilter
          genres={genres}
          currentGenre={genre}
          currentSort={sort}
          currentType={type}
        />
      </Suspense>

      {data.length === 0 ? (
        <p className="text-muted text-center py-20">No manga found.</p>
      ) : (
        <>
          {isFiltered && (
            <p className="text-xs text-muted mb-3">{data.length} titles found</p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {data.map(manga => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
        </>
      )}

      {hasMore && nextCursor && !genre && !type && sort !== 'rating' && (
        <div className="flex justify-center mt-8">
          <Link
            href={`/list?${nextParams.toString()}`}
            className="px-6 py-2 rounded-full bg-surface-2 text-muted hover:bg-accent hover:text-white transition-colors text-sm font-medium"
          >
            Load More
          </Link>
        </div>
      )}
    </div>
  )
}
