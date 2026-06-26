import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import GenreFilter from '@/components/GenreFilter'
import BrowseGrid from '@/components/BrowseGrid'
import MangaCard from '@/components/MangaCard'
import SearchBar from '@/components/SearchBar'
import SearchTypeFilter from '@/components/SearchTypeFilter'
import RecentSearches from '@/components/RecentSearches'

export const dynamic = 'force-dynamic'

async function SearchResults({ query, type }: { query: string; type?: string }) {
  const provider = getProvider()
  const results = await provider.search(query, type ? { type } : undefined)

  if (!results.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-1">
        <p className="text-muted text-sm">No results for &quot;{query}&quot;{type ? ` in ${type}` : ''}</p>
        <p className="text-muted/60 text-xs">Try a different keyword or remove the type filter</p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <p className="text-xs text-muted mb-3">
        {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
        {type && <span className="ml-1 text-accent-2"> in {type}</span>}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {results.map(manga => (
          <MangaCard key={manga.id} manga={manga} />
        ))}
      </div>
    </div>
  )
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; genre?: string; sort?: string; type?: string; after?: string }>
}) {
  const { q = '', genre, sort, type, after } = await searchParams
  const isSearching = q.trim().length > 0
  const provider = getProvider()

  const validSort = sort === 'create' || sort === 'rating' ? sort : sort === 'update' ? 'update' : undefined

  const isFiltered = !!(genre || sort || type)
  const showLoadMore = !genre && !type && sort !== 'rating'

  let browseData: { data: Awaited<ReturnType<typeof provider.getList>>['data']; nextCursor?: string; hasMore: boolean } | null = null
  if (!isSearching) {
    browseData = await provider.getList({ genre, sort: validSort, type, after })
  }

  return (
    <div className="flex flex-col flex-1">
      <h1 className="text-xl font-bold text-fg mb-4">Browse</h1>

      <Suspense>
        <SearchBar key={q} defaultValue={q} />
      </Suspense>

      {isSearching ? (
        <>
          <Suspense>
            <SearchTypeFilter currentType={type} />
          </Suspense>
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <SearchResults query={q} type={type} />
          </Suspense>
        </>
      ) : (
        <>
          <Suspense>
            <RecentSearches />
          </Suspense>
          <Suspense>
            <GenreFilter
              genres={provider.getGenres()}
              currentGenre={genre}
              currentSort={sort}
              currentType={type}
            />
          </Suspense>

          {browseData && browseData.data.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <p className="text-muted text-sm">No manga found.</p>
            </div>
          ) : browseData ? (
            <>
              {isFiltered && (
                <p className="text-xs text-muted mb-3">{browseData.data.length} titles found</p>
              )}
              <BrowseGrid
                key={`${genre ?? ''}-${sort ?? ''}-${type ?? ''}`}
                initialData={browseData.data}
                initialHasMore={browseData.hasMore}
                initialCursor={browseData.nextCursor}
                genre={genre}
                sort={sort}
                type={type}
                showLoadMore={showLoadMore}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
