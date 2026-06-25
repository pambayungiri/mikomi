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

  useEffect(() => {
    try {
      const history: { slug: string; chapter: number }[] = JSON.parse(
        localStorage.getItem('mikomi_history') ?? '[]'
      )
      const entry = history.find(e => e.slug === slug)
      if (entry) setLastRead(entry.chapter)
    } catch { /* ignore */ }
  }, [slug])

  return (
    <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
      {chapters.map(ch => {
        const isLastRead = ch.number === lastRead
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
            <div className="flex items-center gap-2">
              <span className={`text-sm transition-colors ${
                isLastRead ? 'text-accent font-medium' : 'text-fg group-hover:text-accent'
              }`}>
                Chapter {ch.number}
              </span>
              {isLastRead && (
                <span className="text-[10px] text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded-full font-medium">
                  Last read
                </span>
              )}
            </div>
            <span className="text-xs text-muted">
              {ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString('id-ID') : ''}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
