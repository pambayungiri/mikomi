'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const TYPES = [
  { id: '', label: 'All' },
  { id: 'Manga', label: 'Manga' },
  { id: 'Manhwa', label: 'Manhwa' },
  { id: 'Manhua', label: 'Manhua' },
]

export default function SearchTypeFilter({ currentType }: { currentType?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQuery = useCallback((type: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (type) params.set('type', type)
    else params.delete('type')
    return params.toString()
  }, [searchParams])

  return (
    <div className="flex gap-2 mt-3">
      {TYPES.map(t => (
        <button
          key={t.id}
          onClick={() => router.replace(`${pathname}?${createQuery(t.id)}`)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            (currentType ?? '') === t.id
              ? 'bg-accent text-white'
              : 'bg-surface-2 text-muted hover:text-fg'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
