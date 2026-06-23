'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type HistoryEntry = {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
  timestamp: number
}

const KEY = 'mikomi_history'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      setHistory(Array.isArray(data) ? data : [])
    } catch { setHistory([]) }
    setLoaded(true)
  }, [])

  function clearAll() {
    localStorage.removeItem(KEY)
    setHistory([])
  }

  if (!loaded) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">Reading History</h1>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-muted hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-muted text-center py-20 text-sm">No reading history yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry, i) => (
            <Link
              key={i}
              href={`/chapter/${entry.slug}/${entry.chapter}`}
              className="flex items-center gap-4 p-3 rounded-xl bg-surface hover:bg-surface-2 transition-colors group"
            >
              <div className="relative w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                <Image
                  src={entry.mangaImage}
                  alt={entry.mangaName}
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg group-hover:text-accent transition-colors truncate">
                  {entry.mangaName}
                </p>
                <p className="text-xs text-muted mt-0.5">Chapter {entry.chapter}</p>
              </div>
              <span className="text-xs text-muted flex-shrink-0">{relativeTime(entry.timestamp)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
