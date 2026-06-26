'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { readStorage, STORAGE_KEYS } from '@/lib/storage'
import type { HistoryEntry } from '@/lib/storage'

export default function ContinueReadingSection() {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    const data = readStorage<HistoryEntry[]>(STORAGE_KEYS.history, [])
    setHistory(Array.isArray(data) ? data.slice(0, 10) : [])
  }, [])

  if (!history.length) return null

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-fg">Continue Reading</h2>
        <Link href="/history" className="text-xs text-muted hover:text-accent transition-colors">
          See All
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {history.map(entry => (
          <Link
            key={`${entry.slug}-${entry.chapter}`}
            href={`/chapter/${entry.slug}/${entry.chapter}`}
            className="flex-shrink-0 w-24 group"
          >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-surface">
              <Image
                src={entry.mangaImage}
                alt={entry.mangaName}
                fill
                sizes="96px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-white text-[10px] font-semibold">Ch. {entry.chapter}</p>
              </div>
              <div className="absolute inset-0 bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-1.5 text-xs font-medium text-fg line-clamp-2 leading-tight">
              {entry.mangaName}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
