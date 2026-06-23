import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import SearchBar from '@/components/SearchBar'

export const dynamic = 'force-dynamic'

async function SearchResults({ query }: { query: string }) {
  if (!query.trim()) {
    return <p className="text-muted text-center py-20 text-sm">Start typing to search...</p>
  }
  const provider = getProvider()
  const results = await provider.search(query)
  if (!results.length) {
    return <p className="text-muted text-center py-20 text-sm">No results for "{query}"</p>
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-6">
      {results.map(manga => (
        <MangaCard key={manga.id} manga={manga} />
      ))}
    </div>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams

  return (
    <div>
      <h1 className="text-xl font-bold text-fg mb-4">Search</h1>
      <Suspense>
        <SearchBar defaultValue={q} />
      </Suspense>
      <Suspense fallback={<p className="text-muted text-center py-20 text-sm">Searching...</p>}>
        <SearchResults query={q} />
      </Suspense>
    </div>
  )
}
