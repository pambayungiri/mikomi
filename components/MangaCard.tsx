import Image from 'next/image'
import Link from 'next/link'
import type { MangaCard as MangaCardType } from '@/lib/providers/types'
import BookmarkIndicator from './BookmarkIndicator'
import ReadingProgressIndicator from './ReadingProgressIndicator'

const TYPE_BADGE: Record<string, string> = {
  Manga: 'bg-accent text-white',
  Manhwa: 'bg-accent-2 text-white',
  Manhua: 'bg-gold text-black',
}

export default function MangaCard({ manga }: { manga: MangaCardType }) {
  const badgeClass = TYPE_BADGE[manga.type] ?? 'bg-muted text-white'

  return (
    <Link href={`/manga/${manga.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-lg bg-surface aspect-[2/3]">
        <Image
          src={manga.image}
          alt={manga.name}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 160px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized
        />
        <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
          {manga.type}
        </span>
        <BookmarkIndicator slug={manga.slug} />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <h3 className="mt-1.5 text-xs font-semibold text-fg line-clamp-2 leading-tight">{manga.name}</h3>
      {manga.latestChapter !== null && (
        <p className="text-[10px] text-muted mt-0.5">Ch. {manga.latestChapter}</p>
      )}
      <ReadingProgressIndicator slug={manga.slug} latestChapter={manga.latestChapter} />
    </Link>
  )
}
