'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useRef, useEffect } from 'react'

const SORTS = [
  { id: 'update', label: 'Latest Update' },
  { id: 'create', label: 'New Arrivals' },
  { id: 'rating', label: 'Top Rated' },
]

const TYPES = ['Manga', 'Manhwa', 'Manhua']

const GENRES = [
  'Action', 'Fantasy', 'Adventure', 'Comedy', 'Sci-Fi',
  'Romance', 'Mystery', 'Horror', 'Slice of Life', 'Supernatural', 'Isekai',
]

function Dropdown({
  label,
  children,
}: {
  label: React.ReactNode
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
          open ? 'bg-accent text-white border-accent' : 'bg-surface border-border text-muted hover:text-fg hover:border-border/70'
        }`}
      >
        {label}
        <svg
          xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl min-w-[180px] p-1">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export default function GenreFilter({
  genres: _genres,
  currentGenre,
  currentSort,
  currentType,
}: {
  genres: string[]
  currentGenre?: string
  currentSort?: string
  currentType?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const push = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('after')
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null) params.delete(k)
      else params.set(k, v)
    })
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, router, pathname])

  const activeSort = SORTS.find(s => s.id === currentSort)
  const hasFilters = !!(currentGenre || currentSort || currentType)

  return (
    <div className="mb-6 space-y-3">
      {/* Row: type pills (scrollable) + dropdowns (outside overflow so panels aren't clipped) */}
      <div className="flex items-center gap-2">
        {/* Scrollable type pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1 min-w-0">
          <button
            onClick={() => push({ type: null, genre: null, sort: null })}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !currentType ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-fg'
            }`}
          >
            All
          </button>
          {TYPES.map(t => (
            <button
              key={t}
              onClick={() => push({ type: currentType === t ? null : t, genre: null, sort: currentSort ?? null })}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentType === t ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-fg'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Dropdowns — kept outside overflow container so the panel isn't clipped */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Dropdown
            label={
              <span className={currentGenre ? 'text-white' : ''}>
                {currentGenre ?? 'Genre'}
              </span>
            }
          >
            {close => (
              <>
                {currentGenre && (
                  <button
                    onClick={() => { push({ genre: null }); close() }}
                    className="w-full text-left px-3 py-2 text-xs text-accent hover:bg-surface-2 rounded-lg transition-colors"
                  >
                    Clear genre
                  </button>
                )}
                {(GENRES.length ? GENRES : _genres).map(g => (
                  <button
                    key={g}
                    onClick={() => { push({ genre: currentGenre === g ? null : g, sort: null, type: null }); close() }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      currentGenre === g ? 'text-accent font-medium bg-accent/10' : 'text-fg hover:bg-surface-2'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </>
            )}
          </Dropdown>

          <Dropdown
            label={
              <span className={currentSort ? 'text-white' : ''}>
                {activeSort?.label ?? 'Sort'}
              </span>
            }
          >
            {close => SORTS.map(s => (
              <button
                key={s.id}
                onClick={() => { push({ sort: currentSort === s.id ? null : s.id, genre: null }); close() }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentSort === s.id ? 'text-accent font-medium bg-accent/10' : 'text-fg hover:bg-surface-2'
                }`}
              >
                {s.label}
              </button>
            ))}
          </Dropdown>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap gap-1.5">
          {currentType && (
            <button
              onClick={() => push({ type: null })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
            >
              {currentType}
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
          {currentGenre && (
            <button
              onClick={() => push({ genre: null })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
            >
              {currentGenre}
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
          {currentSort && (
            <button
              onClick={() => push({ sort: null })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
            >
              {activeSort?.label}
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
          <button
            onClick={() => push({ type: null, genre: null, sort: null })}
            className="px-2.5 py-1 rounded-full bg-surface-2 text-muted text-xs hover:text-fg transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
