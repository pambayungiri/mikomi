'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { MangaCard } from '@/lib/providers/types'

const TYPE_BADGE: Record<string, string> = {
  Manga: 'bg-accent',
  Manhwa: 'bg-accent-2',
  Manhua: 'bg-gold',
}

export default function HeroCarousel({ items }: { items: MangaCard[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % items.length), 4000)
    return () => clearInterval(id)
  }, [items.length])

  if (!items.length) return null

  return (
    <div className="relative rounded-xl overflow-hidden h-72 md:h-96 mb-10 bg-surface">
      {items.map((manga, i) => (
        <Link
          key={manga.id}
          href={`/manga/${manga.slug}`}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Image
            src={manga.image}
            alt={manga.name}
            fill
            sizes="100vw"
            className="object-cover object-top"
            unoptimized
            priority={i === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
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

      {/* Dot indicators */}
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); setCurrent(i) }}
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  )
}
