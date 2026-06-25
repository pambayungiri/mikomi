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
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY)
      if (saved === 'single' || saved === 'strip') setMode(saved)
    } catch { /* ignore */ }
  }, [])

  // Progress tracking
  useEffect(() => {
    if (mode === 'single') {
      setProgress(pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 0)
      return
    }
    // Strip mode: track scroll position
    function handleScroll() {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [mode, pageIndex, pages.length])

  function toggleMode() {
    const nextMode = mode === 'strip' ? 'single' : 'strip'
    setMode(nextMode)
    setPageIndex(0)
    setProgress(0)
    try { localStorage.setItem(MODE_KEY, nextMode) } catch { /* ignore */ }
  }

  const goNext = useCallback(() => {
    if (mode === 'single' && pageIndex < pages.length - 1) setPageIndex(p => p + 1)
  }, [mode, pageIndex, pages.length])

  const goPrev = useCallback(() => {
    if (mode === 'single' && pageIndex > 0) setPageIndex(p => p - 1)
  }, [mode, pageIndex])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  const ModeIcon = ({ m }: { m: 'strip' | 'single' }) => m === 'strip' ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><rect x="3" y="17" width="18" height="5" rx="1"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  )

  return (
    <div>
      {/* Reading progress bar */}
      <div className="fixed top-14 left-0 right-0 h-0.5 bg-border z-40 pointer-events-none">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/manga/${slug}`}
          className="text-sm text-muted hover:text-fg transition-colors flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          <span className="truncate max-w-40">{mangaName}</span>
        </Link>
        <span className="text-sm text-muted font-medium">Chapter {chapter}</span>
        <button
          onClick={toggleMode}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-surface-2 text-muted hover:text-fg transition-colors"
          aria-label={mode === 'strip' ? 'Switch to single-page mode' : 'Switch to long-strip mode'}
        >
          <ModeIcon m={mode} />
          {mode === 'strip' ? 'Single' : 'Strip'}
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
          <div className="w-full max-w-2xl relative select-none">
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
            {/* Tap zone — left (prev) */}
            <button
              onClick={goPrev}
              className="absolute left-0 inset-y-0 w-1/3 flex items-center justify-start pl-3"
              aria-label="Previous page"
            >
              {pageIndex > 0 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28" height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/25 drop-shadow"
                >
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              )}
            </button>
            {/* Tap zone — right (next) */}
            <button
              onClick={goNext}
              className="absolute right-0 inset-y-0 w-1/3 flex items-center justify-end pr-3"
              aria-label="Next page"
            >
              {pageIndex < pages.length - 1 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="28" height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/25 drop-shadow"
                >
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              )}
            </button>
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

        <button
          onClick={toggleMode}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-surface-2 text-muted hover:text-fg transition-colors border-l border-border ml-1 pl-3"
          aria-label="Toggle reading mode"
        >
          <ModeIcon m={mode} />
        </button>
      </div>

      <div className="h-20" />
    </div>
  )
}
