'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'

function PageImage({ src, index }: { src: string; index: number }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="w-full max-w-2xl relative">
      {!loaded && (
        <div className="w-full aspect-[2/3] bg-surface-2 animate-pulse rounded" />
      )}
      <Image
        src={src}
        alt={`Page ${index + 1}`}
        width={800}
        height={1200}
        className={`w-full h-auto ${loaded ? '' : 'absolute inset-0 opacity-0'}`}
        unoptimized
        loading={index < 3 ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}

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
  const [singleLoaded, setSingleLoaded] = useState(false)
  // Bottom nav auto-hides in strip mode; top bar stays always visible
  const [showBottomNav, setShowBottomNav] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const saved = readStorage<string>(STORAGE_KEYS.readingMode, 'strip')
    if (saved === 'single' || saved === 'strip') setMode(saved)
  }, [])

  // Cache chapter images in service worker for offline reading
  useEffect(() => {
    if (!pages.length || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({
        type: 'CACHE_CHAPTER',
        urls: pages,
        chapterUrl: `/chapter/${slug}/${chapter}`,
        apiUrl:     `/api/chapter/${slug}/${chapter}`,
      })
    }).catch(() => {})
  }, [pages, slug, chapter])

  // Hide bottom nav when user pinch-zooms (iOS: fixed elements shift with zoom)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      setShowBottomNav((vv?.scale ?? 1) <= 1.05)
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  // In strip mode, tap to toggle bottom nav visibility with auto-hide
  function scheduleHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowBottomNav(true)
    hideTimerRef.current = setTimeout(() => setShowBottomNav(false), 4000)
  }

  function handleStripTap() {
    if (mode !== 'strip') return
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowBottomNav(v => {
      if (!v) scheduleHide()
      return !v
    })
  }

  useEffect(() => {
    if (mode === 'strip') {
      scheduleHide()
    } else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      setShowBottomNav(true)
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Progress tracking
  useEffect(() => {
    if (mode === 'single') {
      setProgress(pages.length > 0 ? ((pageIndex + 1) / pages.length) * 100 : 0)
      return
    }
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
    setSingleLoaded(false)
    writeStorage(STORAGE_KEYS.readingMode, nextMode)
  }

  const goNext = useCallback(() => {
    if (mode === 'single' && pageIndex < pages.length - 1) {
      setPageIndex(p => p + 1)
      setSingleLoaded(false)
    }
  }, [mode, pageIndex, pages.length])

  const goPrev = useCallback(() => {
    if (mode === 'single' && pageIndex > 0) {
      setPageIndex(p => p - 1)
      setSingleLoaded(false)
    }
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

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/40">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        </svg>
        <p className="text-muted text-sm">Halaman chapter ini belum tersedia.</p>
        <Link href={`/manga/${slug}`} className="text-sm text-accent hover:underline">
          Kembali ke daftar chapter
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Reading progress bar */}
      <div className="fixed top-14 left-0 right-0 h-0.5 bg-border z-40 pointer-events-none">
        <div className="h-full bg-accent transition-all duration-200" style={{ width: `${progress}%` }} />
      </div>

      {/* Top bar — always visible so user can always go back or switch mode */}
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
        <span className="text-sm text-muted font-medium">Ch. {chapter}</span>
        <button
          onClick={toggleMode}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-surface-2 text-muted hover:text-fg transition-colors"
          aria-label={mode === 'strip' ? 'Switch to single-page' : 'Switch to long-strip'}
        >
          <ModeIcon m={mode} />
          {mode === 'strip' ? 'Single' : 'Strip'}
        </button>
      </div>

      {/* Reader content */}
      {mode === 'strip' ? (
        // Tap anywhere on strip to toggle bottom nav
        <div className="flex flex-col items-center gap-1" onClick={handleStripTap}>
          {pages.map((src, i) => (
            <PageImage key={src} src={src} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl relative select-none">
            {!singleLoaded && (
              <div className="w-full aspect-[2/3] bg-surface-2 animate-pulse rounded" />
            )}
            <Image
              key={pageIndex}
              src={pages[pageIndex]}
              alt={`Page ${pageIndex + 1}`}
              width={800}
              height={1200}
              className={`w-full h-auto ${singleLoaded ? '' : 'absolute inset-0 opacity-0'}`}
              unoptimized
              priority
              onLoad={() => setSingleLoaded(true)}
            />
            {/* Tap zone — left (prev) */}
            <button
              onClick={goPrev}
              className="absolute left-0 inset-y-0 w-1/3 flex items-center justify-start"
              aria-label="Previous page"
            >
              {pageIndex > 0 && (
                <div className="ml-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </div>
              )}
            </button>
            {/* Tap zone — right (next) */}
            <button
              onClick={goNext}
              className="absolute right-0 inset-y-0 w-1/3 flex items-center justify-end"
              aria-label="Next page"
            >
              {pageIndex < pages.length - 1 && (
                <div className="mr-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              )}
            </button>
          </div>
          <p className="text-muted text-sm mt-3">{pageIndex + 1} / {pages.length}</p>
        </div>
      )}

      {/* Bottom nav — anchored to safe edge, hides when zoomed or in strip mode after delay */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-3 transition-all duration-300 ${
          showBottomNav ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-4 bg-surface/95 backdrop-blur-sm border border-border rounded-2xl px-5 py-2.5 shadow-xl">
          {prev !== null ? (
            <Link href={`/chapter/${slug}/${prev}`} className="flex items-center gap-1 text-sm text-muted hover:text-fg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
              Ch. {prev}
            </Link>
          ) : (
            <span className="text-sm text-border/50">First</span>
          )}

          <span className="text-xs text-muted px-3 border-x border-border">
            {mode === 'single' ? `${pageIndex + 1} / ${pages.length}` : `${pages.length}p`}
          </span>

          {next !== null ? (
            <Link href={`/chapter/${slug}/${next}`} className="flex items-center gap-1 text-sm text-muted hover:text-fg transition-colors">
              Ch. {next}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          ) : (
            <span className="text-sm text-border/50">Last</span>
          )}
        </div>
      </div>

      <div className="h-24" />
    </div>
  )
}
