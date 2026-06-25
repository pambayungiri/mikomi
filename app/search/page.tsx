import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import SearchBar from '@/components/SearchBar'
import SearchTypeFilter from '@/components/SearchTypeFilter'
import RecentSearches from '@/components/RecentSearches'

export const dynamic = 'force-dynamic'

async function SearchResults({ query, type }: { query: string; type?: string }) {
  if (!query.trim()) {
    return <RecentSearches />
  }

  const provider = getProvider()
  const results = await provider.search(query, type ? { type } : undefined)

  if (!results.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-1">
        <p className="text-muted text-sm">No results for &quot;{query}&quot;{type ? ` in ${type}` : ''}</p>
        <p className="text-muted/60 text-xs">Try a different keyword or remove the type filter</p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <p className="text-xs text-muted mb-3">
        {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
        {type && <span className="ml-1 text-accent-2">in {type}</span>}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {results.map(manga => (
          <MangaCard key={manga.id} manga={manga} />
        ))}
      </div>
    </div>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>
}) {
  const { q = '', type } = await searchParams

  return (
    <div>
      <h1 className="text-xl font-bold text-fg mb-4">Search</h1>
      <Suspense>
        <SearchBar defaultValue={q} />
        <SearchTypeFilter currentType={type} />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <SearchResults query={q} type={type} />
      </Suspense>
    </div>
  )
}
