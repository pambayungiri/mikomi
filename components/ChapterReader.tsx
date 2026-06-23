'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const MODE_KEY = 'mikomi_reading_mode'

export default function ChapterReader({
  pages,
  slug,
  chapter,
  prev,
  next,
  mangaName,
}: {
  pages: string[]
  slug: string
  chapter: number
  prev: number | null
  next: number | null
  mangaName: string
}) {
  const [mode, setMode] = useState<'strip' | 'single'>('strip')
  const [pageIndex, setPageIndex] = useState(0)

  // Load persisted mode
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY)
      if (saved === 'single' || saved === 'strip') setMode(saved)
    } catch { /* ignore */ }
  }, [])

  function toggleMode() {
    const nextMode = mode === 'strip' ? 'single' : 'strip'
    setMode(nextMode)
    setPageIndex(0)
    try { localStorage.setItem(MODE_KEY, nextMode) } catch { /* ignore */ }
  }

  const goNext = useCallback(() => {
    if (mode === 'single') {
      if (pageIndex < pages.length - 1) setPageIndex(p => p + 1)
    }
  }, [mode, pageIndex, pages.length])

  const goPrev = useCallback(() => {
    if (mode === 'single') {
      if (pageIndex > 0) setPageIndex(p => p - 1)
    }
  }, [mode, pageIndex])

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/manga/${slug}`} className="text-sm text-muted hover:text-fg transition-colors flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          {mangaName}
        </Link>
        <span className="text-sm text-muted font-medium">Chapter {chapter}</span>
        <button
          onClick={toggleMode}
          className="text-xs px-3 py-1 rounded-full bg-surface-2 text-muted hover:text-fg transition-colors"
        >
          {mode === 'strip' ? '📄 Single' : '📜 Strip'}
        </button>
      </div>

      {/* Reader */}
      {mode === 'strip' ? (
        <div className="flex flex-col items-center gap-1">
          {pages.map((src, i) => (
            <div key={i} className="w-full max-w-2xl">
              <Image
                src={src}
                alt={`Page ${i + 1}`}
                width={800}
                height={1200}
                className="w-full h-auto"
                unoptimized
                loading={i < 3 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl relative">
            <Image
              key={pageIndex}
              src={pages[pageIndex]}
              alt={`Page ${pageIndex + 1}`}
              width={800}
              height={1200}
              className="w-full h-auto"
              unoptimized
              priority
            />
            {/* Tap zones */}
            <button
              onClick={goPrev}
              className="absolute left-0 inset-y-0 w-1/3 opacity-0"
              aria-label="Previous page"
            />
            <button
              onClick={goNext}
              className="absolute right-0 inset-y-0 w-1/3 opacity-0"
              aria-label="Next page"
            />
          </div>
          <p className="text-muted text-sm mt-3">{pageIndex + 1} / {pages.length}</p>
        </div>
      )}

      {/* Floating bottom nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface border border-border rounded-full px-5 py-2.5 shadow-xl">
        {prev !== null ? (
          <Link href={`/chapter/${slug}/${prev}`} className="text-sm text-muted hover:text-fg transition-colors">
            ← Ch. {prev}
          </Link>
        ) : (
          <span className="text-sm text-border">← First</span>
        )}

        <span className="text-xs text-muted px-2 border-x border-border">
          {mode === 'single' ? `${pageIndex + 1}/${pages.length}` : `${pages.length}p`}
        </span>

        {next !== null ? (
          <Link href={`/chapter/${slug}/${next}`} className="text-sm text-muted hover:text-fg transition-colors">
            Ch. {next} →
          </Link>
        ) : (
          <span className="text-sm text-border">Last →</span>
        )}
      </div>

      <div className="h-20" /> {/* Spacer for floating bar */}
    </div>
  )
}
