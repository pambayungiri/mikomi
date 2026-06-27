'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { MangaCard } from '@/lib/providers/types'
import { proxyUrl } from '@/lib/proxy'

const TYPE_BADGE: Record<string, string> = {
  Manga: 'bg-accent',
  Manhwa: 'bg-accent-2',
  Manhua: 'bg-gold',
}

export default function HeroCarousel({ items }: { items: MangaCard[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % items.length), 4500)
  }

  useEffect(() => {
    if (!paused) startTimer()
    else if (timerRef.current) clearInterval(timerRef.current)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, items.length])

  if (!items.length) return null

  function goPrev() {
    setCurrent(c => (c - 1 + items.length) % items.length)
    startTimer()
  }

  function goNext() {
    setCurrent(c => (c + 1) % items.length)
    startTimer()
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden h-72 md:h-96 mb-10 bg-surface"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {items.map((manga, i) => (
        <Link
          key={manga.id}
          href={`/manga/${manga.slug}`}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Image
            src={proxyUrl(manga.image)}
            alt={manga.name}
            fill
            sizes="100vw"
            className="object-cover object-top"
            unoptimized
            priority={i === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${TYPE_BADGE[manga.type] ?? 'bg-muted'}`}>
              {manga.type}
            </span>
            <h2 className="text-white text-xl md:text-2xl font-bold mt-2 line-clamp-2">{manga.name}</h2>
            {manga.latestChapter !== null && (
              <p className="text-white/70 text-sm mt-1">Chapter {manga.latestChapter}</p>
            )}
          </div>
        </Link>
      ))}

      {/* Prev / Next arrows */}
      <button
        onClick={goPrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-colors z-10"
        aria-label="Previous"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      <button
        onClick={goNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-colors z-10"
        aria-label="Next"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>

      {/* Dot indicators — bigger, accessible */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-10">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); setCurrent(i); startTimer() }}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-white w-5' : 'bg-white/40 w-2 hover:bg-white/70'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Pause indicator */}
      {paused && (
        <div className="absolute top-3 right-3 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
        </div>
      )}
    </div>
  )
}
