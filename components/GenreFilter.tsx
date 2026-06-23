'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const SORTS = [
  { id: 'update', label: 'Latest Update' },
  { id: 'create', label: 'New Arrivals' },
]

export default function GenreFilter({ genres, currentGenre, currentSort }: {
  genres: string[]
  currentGenre?: string
  currentSort?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('after') // reset pagination on filter change
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null) params.delete(k)
      else params.set(k, v)
    })
    return params.toString()
  }, [searchParams])

  return (
    <div className="mb-6 space-y-3">
      {/* Sort toggles */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`${pathname}?${createQuery({ sort: null, genre: null })}`)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!currentGenre && !currentSort ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}
        >
          All
        </button>
        {SORTS.map(s => (
          <button
            key={s.id}
            onClick={() => router.push(`${pathname}?${createQuery({ sort: s.id, genre: null })}`)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentSort === s.id ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Genre pills */}
      <div className="flex flex-wrap gap-2">
        {genres.map(g => (
          <button
            key={g}
            onClick={() => router.push(`${pathname}?${createQuery({ genre: currentGenre === g ? null : g, sort: null })}`)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              currentGenre === g
                ? 'bg-accent border-accent text-white'
                : 'border-border text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}
