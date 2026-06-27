import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { proxyUrl } from '@/lib/proxy'
import { getProvider } from '@/lib/providers'
import AgeGate from '@/components/AgeGate'
import BookmarkButton from '@/components/BookmarkButton'
import ExpandableText from '@/components/ExpandableText'
import ChapterList from '@/components/ChapterList'
import MangaCard from '@/components/MangaCard'

export const revalidate = 1800

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const manga = await getProvider().getManga(slug)
    const genreList = manga.genre.slice(0, 3).join(', ')
    const desc = manga.description
      ? `${manga.description.slice(0, 120)} — Baca gratis di Mikomi.`
      : `Baca manga ${manga.name} bahasa Indonesia online gratis di Mikomi. Genre: ${genreList}. Status: ${manga.status}.`
    return {
      title:       `Baca ${manga.name} Bahasa Indonesia | Mikomi`,
      description: desc,
      openGraph: {
        title:       `Baca ${manga.name} Bahasa Indonesia`,
        description: desc,
        images:      manga.image ? [{ url: manga.image, alt: manga.name }] : [],
        type:        'book',
        siteName:    'Mikomi',
      },
      twitter: {
        card:        'summary_large_image',
        title:       `Baca ${manga.name} Bahasa Indonesia`,
        description: desc,
        images:      manga.image ? [manga.image] : [],
      },
    }
  } catch {
    return { title: 'Manga — Mikomi' }
  }
}

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

  // Fetch related manga in parallel with page render
  const related = manga.genre.length > 0
    ? await provider.getRelated(manga.genre[0], manga.slug)
    : []

  const STATUS_COLOR: Record<string, string> = {
    Ongoing: 'text-accent',
    Completed: 'text-gold',
    Hiatus: 'text-muted',
  }

  return (
    <>
      {manga.contentRating && (
        <AgeGate mangaId={manga.id} contentRating={manga.contentRating} />
      )}
      <Script id="manga-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Book',
          name:          manga.name,
          inLanguage:    'id',
          genre:         manga.genre,
          author:        manga.author ? { '@type': 'Person', name: manga.author } : undefined,
          numberOfPages: manga.chapters.length,
          url:           `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mikomi.vercel.app'}/manga/${manga.slug}`,
          image:         manga.image || undefined,
          description:   manga.description || undefined,
        })
      }} />
      <div className="md:flex gap-8">
        {/* Sidebar */}
        <aside className="md:w-52 flex-shrink-0 md:sticky md:top-20 md:self-start">
          <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-4">
            <Image
              src={proxyUrl(manga.image)}
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
                <dd>
                  <Link
                    href={`/list?q=${encodeURIComponent(manga.author)}`}
                    className="text-fg hover:text-accent transition-colors"
                  >
                    {manga.author}
                  </Link>
                </dd>
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
                <dd className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span className="text-fg font-medium">{manga.rate.toFixed(1)}</span>
                </dd>
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

          {/* Description — expandable */}
          {manga.description && (
            <div className="mt-4">
              <ExpandableText text={manga.description} maxLines={4} />
            </div>
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

          {/* Chapter list — with last read indicator */}
          <div className="mt-8">
            <h2 className="text-base font-semibold text-fg mb-3">{manga.chapters.length} Chapters</h2>
            <ChapterList slug={manga.slug} chapters={manga.chapters} />
          </div>
        </div>
      </div>

      {/* Related manga */}
      {related.length > 0 && (
        <section className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-fg">You May Also Like</h2>
            <Link
              href={`/list?genre=${encodeURIComponent(manga.genre[0])}`}
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              More {manga.genre[0]} →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {related.map(m => (
              <div key={m.id} className="flex-shrink-0 w-28 md:w-32">
                <MangaCard manga={m} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
