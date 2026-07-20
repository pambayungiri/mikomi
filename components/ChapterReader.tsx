'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { readStorage, writeStorage, STORAGE_KEYS, recordHistory } from '@/lib/storage'
import { activeChapterIndex, chapterProgress } from '@/lib/reader'
import { proxyUrl } from '@/lib/proxy'

type LoadedChapter = { number: number; pages: string[]; prev: number | null; next: number | null }

function PageImage({ src, index, eager }: { src: string; index: number; eager: boolean }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="w-full max-w-2xl relative">
      {!loaded && (
        <div className="w-full aspect-[2/3] bg-surface-2 animate-pulse rounded" />
      )}
      <Image
        src={proxyUrl(src)}
        alt={`Page ${index + 1}`}
        width={800}
        height={1200}
        className={`w-full h-auto ${loaded ? '' : 'absolute inset-0 opacity-0'}`}
        unoptimized
        loading={eager ? 'eager' : 'lazy'}
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
  mangaImage,
}: {
  pages: string[]
  slug: string
  chapter: number
  prev: number | null
  next: number | null
  mangaName: string
  mangaImage: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'strip' | 'single'>('strip')
  const [pageIndex, setPageIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [singleLoaded, setSingleLoaded] = useState(false)
  // Bottom nav auto-hides in strip mode; top bar stays always visible
  const [showBottomNav, setShowBottomNav] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [chapters, setChapters] = useState<LoadedChapter[]>([
    { number: chapter, pages, prev, next },
  ])
  const [activeIdx, setActiveIdx] = useState(0)
  const [tail, setTail] = useState<{ status: 'idle' | 'loading' | 'error' | 'last' | 'empty'; chapter?: number }>(
    next === null ? { status: 'last' } : { status: 'idle' }
  )
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([])
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const activeChapter = chapters[activeIdx] ?? chapters[0]
  const recordedRef = useRef<Set<number>>(new Set([chapter]))
  // Bumped whenever the reader collapses (mode toggle) so in-flight loadNext
  // fetches started before the collapse can detect they're stale and bail.
  const generationRef = useRef(0)

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

  const loadNext = useCallback(async () => {
    const gen = generationRef.current
    const last = chapters[chapters.length - 1]
    if (last.next === null) { setTail({ status: 'last' }); return }
    setTail({ status: 'loading', chapter: last.next })
    try {
      const res = await fetch(`/api/chapter/${slug}/${last.next}`)
      if (generationRef.current !== gen) return
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { chapter: number; pages: string[]; prev: number | null; next: number | null }
      if (generationRef.current !== gen) return
      if (data.pages.length === 0) { setTail({ status: 'empty', chapter: data.chapter }); return }
      setChapters(cs => cs.some(c => c.number === data.chapter)
        ? cs
        : [...cs, { number: data.chapter, pages: data.pages, prev: data.prev, next: data.next }])
      setTail(data.next === null ? { status: 'last' } : { status: 'idle' })
    } catch {
      if (generationRef.current !== gen) return
      setTail({ status: 'error', chapter: last.next })
    }
  }, [chapters, slug])

  const loadNextRef = useRef(loadNext)
  useEffect(() => { loadNextRef.current = loadNext }, [loadNext])

  useEffect(() => {
    if (mode !== 'strip' || tail.status !== 'idle') return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) loadNextRef.current() },
      { rootMargin: '1500px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mode, chapters.length, tail.status])

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

  // Progress tracking + active-chapter boundary detection
  useEffect(() => {
    if (mode === 'single') {
      setProgress(activeChapter.pages.length > 0 ? ((pageIndex + 1) / activeChapter.pages.length) * 100 : 0)
      return
    }
    function handleScroll() {
      const bounds = chapterRefs.current
        .filter((el): el is HTMLDivElement => el !== null)
        .map(el => ({ top: el.offsetTop, height: el.offsetHeight }))
      if (bounds.length === 0) return
      const idx = activeChapterIndex(bounds, window.scrollY, window.innerHeight)
      setProgress(chapterProgress(bounds[idx], window.scrollY, window.innerHeight))
      setActiveIdx(idx)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [mode, pageIndex, chapters.length, activeChapter.pages.length])

  // React to active-chapter changes — URL, history, offline cache
  useEffect(() => {
    const ch = chapters[activeIdx]
    if (!ch) return
    window.history.replaceState(null, '', `/chapter/${slug}/${ch.number}`)
    if (!recordedRef.current.has(ch.number)) {
      recordedRef.current.add(ch.number)
      recordHistory({ slug, chapter: ch.number, mangaName, mangaImage })
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.active?.postMessage({
            type: 'CACHE_CHAPTER',
            urls: ch.pages,
            chapterUrl: `/chapter/${slug}/${ch.number}`,
            apiUrl:     `/api/chapter/${slug}/${ch.number}`,
          })
        }).catch(() => {})
      }
    }
  }, [activeIdx, chapters, slug, mangaName, mangaImage])

  function toggleMode() {
    generationRef.current += 1
    const nextMode = mode === 'strip' ? 'single' : 'strip'
    const current = chapters[activeIdx] ?? chapters[0]
    setChapters([current])
    setActiveIdx(0)
    setTail(current.next === null ? { status: 'last' } : { status: 'idle' })
    recordedRef.current = new Set([current.number])
    setMode(nextMode)
    setPageIndex(0)
    setProgress(0)
    setSingleLoaded(false)
    writeStorage(STORAGE_KEYS.readingMode, nextMode)
  }

  const goNext = useCallback(() => {
    if (mode !== 'single') return
    if (pageIndex < activeChapter.pages.length - 1) {
      setPageIndex(p => p + 1)
      setSingleLoaded(false)
    } else if (activeChapter.next !== null) {
      router.push(`/chapter/${slug}/${activeChapter.next}`)
    }
  }, [mode, pageIndex, activeChapter, router, slug])

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
        <span className="text-sm text-muted font-medium">Ch. {activeChapter.number}</span>
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
          {chapters.map((ch, ci) => (
            <div
              key={ch.number}
              data-chapter={ch.number}
              ref={el => { chapterRefs.current[ci] = el }}
              className="w-full flex flex-col items-center gap-1"
            >
              {ci > 0 && (
                <div className="w-full max-w-2xl flex items-center gap-3 py-6 text-xs text-muted">
                  <div className="flex-1 border-t border-border" />
                  <span>Ch. {chapters[ci - 1].number} selesai · Ch. {ch.number}</span>
                  <div className="flex-1 border-t border-border" />
                </div>
              )}
              {ch.pages.map((src, i) => (
                <PageImage key={src} src={src} index={i} eager={i < 3} />
              ))}
            </div>
          ))}

          {tail.status === 'loading' && (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {tail.status === 'error' && (
            <div className="py-8 flex flex-col items-center gap-2 text-sm text-muted">
              <span>Gagal memuat Ch. {tail.chapter}</span>
              <button
                onClick={e => { e.stopPropagation(); loadNext() }}
                className="px-4 py-1.5 rounded-full bg-surface-2 text-fg text-xs hover:bg-border transition-colors"
              >
                Coba lagi
              </button>
            </div>
          )}
          {(tail.status === 'last' || tail.status === 'empty') && (
            <div className="py-10 flex flex-col items-center gap-2 text-sm text-muted">
              <span>{tail.status === 'last' ? 'Chapter terakhir' : `Ch. ${tail.chapter} belum tersedia`}</span>
              <Link href={`/manga/${slug}`} className="text-accent text-xs hover:underline" onClick={e => e.stopPropagation()}>
                Kembali ke {mangaName}
              </Link>
            </div>
          )}
          <div ref={sentinelRef} className="h-px w-full" />
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl relative select-none">
            {!singleLoaded && (
              <div className="w-full aspect-[2/3] bg-surface-2 animate-pulse rounded" />
            )}
            <Image
              key={pageIndex}
              src={proxyUrl(activeChapter.pages[pageIndex])}
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
              {(pageIndex < activeChapter.pages.length - 1 || activeChapter.next !== null) && (
                <div className="mr-2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center shadow">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              )}
            </button>
          </div>
          <p className="text-muted text-sm mt-3">{pageIndex + 1} / {activeChapter.pages.length}</p>
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
          {activeChapter.prev !== null ? (
            <Link href={`/chapter/${slug}/${activeChapter.prev}`} className="flex items-center gap-1 text-sm text-muted hover:text-fg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
              Ch. {activeChapter.prev}
            </Link>
          ) : (
            <span className="text-sm text-border/50">First</span>
          )}

          <span className="text-xs text-muted px-3 border-x border-border">
            {mode === 'single' ? `${pageIndex + 1} / ${activeChapter.pages.length}` : `${activeChapter.pages.length}p`}
          </span>

          {activeChapter.next !== null ? (
            <Link href={`/chapter/${slug}/${activeChapter.next}`} className="flex items-center gap-1 text-sm text-muted hover:text-fg transition-colors">
              Ch. {activeChapter.next}
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
