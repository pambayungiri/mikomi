'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { ChapterMeta } from '@/lib/providers/types'
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { OfflineEntry } from '@/lib/storage'

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
  const [swSupported, setSwSupported] = useState(false)

  useEffect(() => {
    // Check SW support only on client
    setSwSupported('serviceWorker' in navigator)

    try {
      const history = readStorage<{ slug: string; chapter: number }[]>(STORAGE_KEYS.history, [])
      const entry = history.find(e => e.slug === slug)
      if (entry) setLastRead(entry.chapter)

      const offline = readStorage<OfflineEntry[]>(STORAGE_KEYS.offline, [])
      setSaved(new Set(offline.filter(o => o.slug === slug).map(o => o.chapter)))
    } catch { /* ignore */ }
  }, [slug])

  async function saveOffline(chapterNum: number) {
    if (saving !== null || saved.has(chapterNum)) return
    setSaving(chapterNum)
    try {
      const res = await fetch(`/api/chapter/${slug}/${chapterNum}`)
      if (!res.ok) throw new Error('fetch failed')
      const { pages } = await res.json() as { pages: string[] }

      const reg = await navigator.serviceWorker.ready
      reg.active?.postMessage({
        type: 'CACHE_CHAPTER',
        urls: pages,
        chapterUrl: `/chapter/${slug}/${chapterNum}`,
        apiUrl: `/api/chapter/${slug}/${chapterNum}`,
      })

      const existing = readStorage<OfflineEntry[]>(STORAGE_KEYS.offline, [])
      const updated: OfflineEntry[] = [
        ...existing.filter(o => !(o.slug === slug && o.chapter === chapterNum)),
        { slug, chapter: chapterNum },
      ]
      writeStorage(STORAGE_KEYS.offline, updated)
      setSaved(prev => new Set([...prev, chapterNum]))
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
          // Wrapper div — button lives here as sibling of Link, not nested inside
          <div
            key={ch.number}
            className={`flex items-center rounded-lg transition-colors group ${
              isLastRead ? 'bg-accent/10 border border-accent/20' : 'bg-surface hover:bg-surface-2'
            }`}
          >
            <Link
              href={`/chapter/${slug}/${ch.number}`}
              className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2"
            >
              <span className={`text-sm transition-colors truncate ${
                isLastRead ? 'text-accent font-medium' : 'text-fg group-hover:text-accent'
              }`}>
                Chapter {ch.number}
              </span>
              {isLastRead && (
                <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  Last read
                </span>
              )}
              <span className="text-xs text-muted ml-auto shrink-0">
                {ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString('id-ID') : ''}
              </span>
            </Link>

            {/* Download button — sibling of Link, not nested inside */}
            {swSupported && (
              <button
                onClick={() => saveOffline(ch.number)}
                disabled={isSaved || isSaving}
                aria-label={isSaved ? 'Saved offline' : 'Save for offline reading'}
                title={isSaved ? 'Saved offline' : 'Save for offline'}
                className={`p-2 pr-3 shrink-0 transition-colors ${
                  isSaved ? 'text-accent' : 'text-border hover:text-muted'
                }`}
              >
                {isSaving ? (
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
