import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import GenreFilter from '@/components/GenreFilter'
import BrowseGrid from '@/components/BrowseGrid'

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

  const isFiltered = !!(genre || sort || type)
  const showLoadMore = !genre && !type && sort !== 'rating'

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
          <BrowseGrid
            key={`${genre ?? ''}-${sort ?? ''}-${type ?? ''}`}
            initialData={data}
            initialHasMore={hasMore}
            initialCursor={nextCursor}
            genre={genre}
            sort={sort}
            type={type}
            showLoadMore={showLoadMore}
          />
        </>
      )}
    </div>
  )
}
