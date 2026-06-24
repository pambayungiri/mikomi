import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProvider } from '@/lib/providers'
import BookmarkButton from '@/components/BookmarkButton'

export const revalidate = 1800

export default async function MangaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const provider = getProvider()

  let manga
  try {
    manga = await provider.getManga(slug)
  } catch {
    notFound()
  }

  const STATUS_COLOR: Record<string, string> = {
    Ongoing: 'text-accent',
    Completed: 'text-gold',
    Hiatus: 'text-muted',
  }

  return (
    <div className="md:flex gap-8">
      {/* Sidebar */}
      <aside className="md:w-52 flex-shrink-0 md:sticky md:top-20 md:self-start">
        <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-4">
          <Image
            src={manga.image}
            alt={manga.name}
            fill
            sizes="208px"
            className="object-cover"
            unoptimized
            priority
          />
        </div>
        <BookmarkButton manga={manga} />

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted text-xs">Status</dt>
            <dd className={`font-medium ${STATUS_COLOR[manga.status] ?? 'text-fg'}`}>{manga.status}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Type</dt>
            <dd className="text-fg">{manga.type}</dd>
          </div>
          {manga.author && (
            <div>
              <dt className="text-muted text-xs">Author</dt>
              <dd className="text-fg">{manga.author}</dd>
            </div>
          )}
          {manga.rilis && (
            <div>
              <dt className="text-muted text-xs">Released</dt>
              <dd className="text-fg">{manga.rilis}</dd>
            </div>
          )}
          {manga.rate > 0 && (
            <div>
              <dt className="text-muted text-xs">Rating</dt>
              <dd className="text-fg">⭐ {manga.rate.toFixed(1)}</dd>
            </div>
          )}
        </dl>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 mt-6 md:mt-0">
        <h1 className="text-2xl font-bold text-fg">{manga.name}</h1>
        {manga.name2 && <p className="text-muted text-sm mt-1">{manga.name2}</p>}

        {/* Genres */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {manga.genre.map(g => (
            <Link
              key={g}
              href={`/list?genre=${encodeURIComponent(g)}`}
              className="px-2 py-0.5 rounded text-xs bg-surface-2 text-muted hover:text-accent transition-colors"
            >
              {g}
            </Link>
          ))}
        </div>

        {/* Description */}
        {manga.description && (
          <p className="text-muted text-sm leading-relaxed mt-4 line-clamp-4">{manga.description}</p>
        )}

        {/* Start reading */}
        {manga.chapters.length > 0 && (
          <div className="flex gap-3 mt-6">
            <Link
              href={`/chapter/${manga.slug}/${manga.chapters[manga.chapters.length - 1].number}`}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-colors"
            >
              Start Reading
            </Link>
            <Link
              href={`/chapter/${manga.slug}/${manga.chapters[0].number}`}
              className="px-5 py-2 rounded-lg bg-surface-2 text-fg text-sm font-medium hover:bg-accent hover:text-white transition-colors"
            >
              Latest Chapter
            </Link>
          </div>
        )}

        {/* Chapter list */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-fg mb-3">{manga.chapters.length} Chapters</h2>
          <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {manga.chapters.map(ch => (
              <Link
                key={ch.number}
                href={`/chapter/${manga.slug}/${ch.number}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-2 transition-colors group"
              >
                <span className="text-sm text-fg group-hover:text-accent transition-colors">
                  Chapter {ch.number}
                </span>
                <span className="text-xs text-muted">
                  {ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString('id-ID') : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
