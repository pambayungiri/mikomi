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

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
}

function weeklyStats(history: HistoryEntry[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = history.filter(e => e.timestamp >= cutoff)
  const uniqueManga = new Set(thisWeek.map(e => e.slug)).size
  return { chapters: thisWeek.length, manga: uniqueManga }
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

  function removeEntry(slug: string, chapter: number) {
    const updated = history.filter(e => !(e.slug === slug && e.chapter === chapter))
    localStorage.setItem(KEY, JSON.stringify(updated))
    setHistory(updated)
  }

  function clearAll() {
    localStorage.removeItem(KEY)
    setHistory([])
  }

  if (!loaded) return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[72px] rounded-xl bg-surface-2 animate-pulse" />
      ))}
    </div>
  )

  // Group by day
  const groups: { label: string; entries: HistoryEntry[] }[] = []
  for (const entry of history) {
    const label = dayLabel(entry.timestamp)
    const last = groups[groups.length - 1]
    if (last?.label === label) {
      last.entries.push(entry)
    } else {
      groups.push({ label, entries: [entry] })
    }
  }

  const stats = weeklyStats(history)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-fg">
          Reading History
          {history.length > 0 && (
            <span className="text-sm font-normal text-muted ml-2">({history.length})</span>
          )}
        </h1>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-muted hover:text-accent-2 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {stats.chapters > 0 && (
        <div className="flex gap-3 mb-6">
          <div className="flex-1 rounded-xl bg-surface border border-border px-4 py-3">
            <p className="text-2xl font-bold text-accent">{stats.chapters}</p>
            <p className="text-xs text-muted mt-0.5">chapters this week</p>
          </div>
          <div className="flex-1 rounded-xl bg-surface border border-border px-4 py-3">
            <p className="text-2xl font-bold text-accent-2">{stats.manga}</p>
            <p className="text-xs text-muted mt-0.5">series read</p>
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-sm">No reading history yet.</p>
          <Link href="/" className="text-accent text-sm mt-3 inline-block hover:underline">
            Start reading →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {group.label}
              </h2>
              <div className="space-y-1.5">
                {group.entries.map(entry => (
                  <div
                    key={`${entry.slug}-${entry.chapter}`}
                    className="flex items-center gap-4 p-3 rounded-xl bg-surface hover:bg-surface-2 transition-colors group relative"
                  >
                    <Link
                      href={`/chapter/${entry.slug}/${entry.chapter}`}
                      className="flex items-center gap-4 flex-1 min-w-0"
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
                        <p className="text-[10px] text-muted/60 mt-0.5">{relativeTime(entry.timestamp)}</p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/manga/${entry.slug}`}
                        className="text-xs text-muted hover:text-accent transition-colors px-2 py-1 rounded bg-surface-2"
                        title="Go to manga page"
                      >
                        Info
                      </Link>
                      <button
                        onClick={() => removeEntry(entry.slug, entry.chapter)}
                        className="w-7 h-7 rounded-full hover:bg-accent-2/20 text-muted hover:text-accent-2 flex items-center justify-center transition-colors"
                        aria-label="Remove from history"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
