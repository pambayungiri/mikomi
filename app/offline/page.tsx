'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type OfflineEntry = { slug: string; chapter: number }
type MangaGroup = { slug: string; chapters: number[] }

function slugToTitle(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function OfflinePage() {
  const [groups, setGroups] = useState<MangaGroup[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const entries: OfflineEntry[] = JSON.parse(localStorage.getItem('mikomi_offline') ?? '[]')
      const map = new Map<string, number[]>()
      for (const e of entries) {
        if (!map.has(e.slug)) map.set(e.slug, [])
        map.get(e.slug)!.push(e.chapter)
      }
      setGroups(
        [...map.entries()].map(([slug, chapters]) => ({
          slug,
          chapters: chapters.sort((a, b) => a - b),
        }))
      )
    } catch { /* ignore */ } finally {
      setLoaded(true)
    }
  }, [])

  function removeChapter(slug: string, chapter: number) {
    try {
      const entries: OfflineEntry[] = JSON.parse(localStorage.getItem('mikomi_offline') ?? '[]')
      const updated = entries.filter(e => !(e.slug === slug && e.chapter === chapter))
      localStorage.setItem('mikomi_offline', JSON.stringify(updated))
      setGroups(prev =>
        prev
          .map(g => g.slug === slug ? { ...g, chapters: g.chapters.filter(c => c !== chapter) } : g)
          .filter(g => g.chapters.length > 0)
      )
    } catch { /* ignore */ }
  }

  function clearManga(slug: string) {
    try {
      const entries: OfflineEntry[] = JSON.parse(localStorage.getItem('mikomi_offline') ?? '[]')
      const updated = entries.filter(e => e.slug !== slug)
      localStorage.setItem('mikomi_offline', JSON.stringify(updated))
      setGroups(prev => prev.filter(g => g.slug !== slug))
    } catch { /* ignore */ }
  }

  if (!loaded) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-surface rounded-xl p-4 animate-pulse">
          <div className="h-4 w-40 bg-surface-2 rounded mb-3" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-8 w-20 bg-surface-2 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-fg">
          Saved
          {groups.length > 0 && (
            <span className="text-sm font-normal text-muted ml-2">
              ({groups.reduce((sum, g) => sum + g.chapters.length, 0)} chapters)
            </span>
          )}
        </h1>
      </div>

      {groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <svg className="text-muted/40 mb-1" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <p className="text-muted text-sm">No saved chapters</p>
          <p className="text-muted/60 text-xs">Download chapters from a manga page to read offline</p>
          <Link href="/list" className="mt-2 text-accent text-sm hover:underline">Browse manga →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => (
            <div key={g.slug} className="bg-surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <Link
                  href={`/manga/${g.slug}`}
                  className="text-sm font-semibold text-fg hover:text-accent transition-colors line-clamp-1"
                >
                  {slugToTitle(g.slug)}
                </Link>
                <button
                  onClick={() => clearManga(g.slug)}
                  className="text-xs text-muted hover:text-accent-2 transition-colors flex-shrink-0 ml-3"
                >
                  Remove all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {g.chapters.map(ch => (
                  <div key={ch} className="group/ch relative">
                    <Link
                      href={`/chapter/${g.slug}/${ch}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-xs text-muted hover:text-fg hover:bg-accent/10 transition-colors pr-6"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      Ch. {ch}
                    </Link>
                    <button
                      onClick={() => removeChapter(g.slug, ch)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full text-muted/50 hover:text-accent-2 transition-colors flex items-center justify-center"
                      aria-label="Remove"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
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
