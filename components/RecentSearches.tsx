'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STORAGE_KEYS } from '@/lib/storage'

const MAX = 6

export function saveSearch(query: string) {
  if (!query.trim()) return
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.recentSearches) ?? '[]')
    const updated = [query, ...existing.filter(q => q !== query)].slice(0, MAX)
    localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(updated))
  } catch { /* ignore */ }
}

export default function RecentSearches() {
  const [recents, setRecents] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.recentSearches) ?? '[]')
      setRecents(Array.isArray(data) ? data : [])
    } catch { setRecents([]) }
  }, [])

  function clear() {
    localStorage.removeItem(STORAGE_KEYS.recentSearches)
    setRecents([])
  }

  function search(q: string) {
    router.push(`/list?q=${encodeURIComponent(q)}`)
  }

  if (!recents.length) return null

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted font-medium">Recent searches</p>
        <button onClick={clear} className="text-xs text-muted hover:text-accent-2 transition-colors">Clear</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {recents.map(q => (
          <button
            key={q}
            onClick={() => search(q)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 text-sm text-muted hover:text-fg hover:bg-surface-2/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
