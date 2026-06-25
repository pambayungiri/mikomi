'use client'

import { useEffect, useState } from 'react'

const HISTORY_KEY = 'mikomi_history'

export default function ReadingProgressIndicator({ slug, latestChapter }: { slug: string; latestChapter: number | null }) {
  const [lastRead, setLastRead] = useState<number | null>(null)

  useEffect(() => {
    function check() {
      try {
        const data: { slug: string; chapter: number }[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
        const entry = data.find(e => e.slug === slug)
        setLastRead(entry?.chapter ?? null)
      } catch { setLastRead(null) }
    }
    check()
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [slug])

  if (lastRead === null || latestChapter === null || latestChapter === 0) return null

  const pct = Math.min(100, Math.round((lastRead / latestChapter) * 100))

  return (
    <div className="mt-0.5 h-0.5 w-full rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}
