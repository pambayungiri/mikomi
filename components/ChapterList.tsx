'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ChapterMeta } from '@/lib/providers/types'

export default function ChapterList({
  slug,
  chapters,
}: {
  slug: string
  chapters: ChapterMeta[]
}) {
  const [lastRead, setLastRead] = useState<number | null>(null)
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    try {
      const history: { slug: string; chapter: number }[] = JSON.parse(
        localStorage.getItem('mikomi_history') ?? '[]'
      )
      const entry = history.find(e => e.slug === slug)
      if (entry) setLastRead(entry.chapter)

      const offline: { slug: string; chapter: number }[] = JSON.parse(
        localStorage.getItem('mikomi_offline') ?? '[]'
      )
      setSaved(new Set(offline.filter(o => o.slug === slug).map(o => o.chapter)))
    } catch { /* ignore */ }
  }, [slug])

  async function saveOffline(e: React.MouseEvent, chapter: number) {
    e.preventDefault()
    if (saving !== null || saved.has(chapter)) return
    setSaving(chapter)
    try {
      const res = await fetch(`/api/chapter/${slug}/${chapter}`)
      if (!res.ok) throw new Error('Failed to fetch chapter')
      const { pages } = await res.json() as { pages: string[] }

      const reg = await navigator.serviceWorker.ready
      reg.active?.postMessage({ type: 'CACHE_CHAPTER', urls: pages })

      const existing: { slug: string; chapter: number }[] = JSON.parse(
        localStorage.getItem('mikomi_offline') ?? '[]'
      )
      const updated = [...existing.filter(o => !(o.slug === slug && o.chapter === chapter)), { slug, chapter }]
      localStorage.setItem('mikomi_offline', JSON.stringify(updated))
      setSaved(prev => new Set([...prev, chapter]))
    } catch { /* ignore */ }
    setSaving(null)
  }

  return (
    <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
      {chapters.map(ch => {
        const isLastRead = ch.number === lastRead
        const isSaved = saved.has(ch.number)
        const isSaving = saving === ch.number
        return (
          <Link
            key={ch.number}
            href={`/chapter/${slug}/${ch.number}`}
            className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors group ${
              isLastRead
                ? 'bg-accent/10 border border-accent/20'
                : 'bg-surface hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`text-sm transition-colors ${
                isLastRead ? 'text-accent font-medium' : 'text-fg group-hover:text-accent'
              }`}>
                Chapter {ch.number}
              </span>
              {isLastRead && (
                <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  Last read
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted">
                {ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString('id-ID') : ''}
              </span>
              {'serviceWorker' in navigator && (
                <button
                  onClick={e => saveOffline(e, ch.number)}
                  disabled={isSaved || isSaving}
                  aria-label={isSaved ? 'Saved offline' : 'Save for offline'}
                  className={`p-1 rounded transition-colors ${
                    isSaved ? 'text-accent' : 'text-muted/40 hover:text-muted'
                  }`}
                >
                  {isSaving ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : isSaved ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
