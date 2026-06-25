import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import SearchBar from '@/components/SearchBar'
import SearchTypeFilter from '@/components/SearchTypeFilter'

export const dynamic = 'force-dynamic'

async function SearchResults({ query, type }: { query: string; type?: string }) {
  if (!query.trim()) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-sm">Start typing to search manga, manhwa, or manhua...</p>
        <p className="text-muted/60 text-xs mt-2">Try searching by title, e.g. "solo leveling", "one piece"</p>
      </div>
    )
  }

  const provider = getProvider()
  const results = await provider.search(query, type ? { type } : undefined)

  if (!results.length) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-sm">No results for &quot;{query}&quot;{type ? ` in ${type}` : ''}</p>
        <p className="text-muted/60 text-xs mt-2">Try a different keyword or check the spelling</p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <p className="text-xs text-muted mb-3">{results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;</p>
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
          <div className="text-center py-20">
            <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <SearchResults query={q} type={type} />
      </Suspense>
    </div>
  )
}
