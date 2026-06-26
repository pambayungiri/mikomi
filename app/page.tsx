import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import HeroCarousel from '@/components/HeroCarousel'
import ContinueReadingSection from '@/components/ContinueReadingSection'
import Link from 'next/link'

export const revalidate = 3600

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      <Link href={href} className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1">
        See All
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
      </Link>
    </div>
  )
}

function HorizontalSection({ title, href, items }: { title: string; href: string; items: Awaited<ReturnType<ReturnType<typeof getProvider>['getTopRatedByType']>> }) {
  if (!items.length) return null
  return (
    <section className="mb-10">
      <SectionHeader title={title} href={href} />
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {items.map(manga => (
          <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
            <MangaCard manga={manga} />
          </div>
        ))}
      </div>
    </section>
  )
}

export default async function HomePage() {
  const provider = getProvider()
  const [
    popular,
    latestUpdate,
    newArrivals,
    topManga,
    topManhwa,
    topManhua,
  ] = await Promise.all([
    provider.getPopular(),
    provider.getLatestUpdate(),
    provider.getNewArrivals(),
    provider.getTopRatedByType('Manga'),
    provider.getTopRatedByType('Manhwa'),
    provider.getTopRatedByType('Manhua'),
  ])

  return (
    <div>
      <HeroCarousel items={popular} />

      <ContinueReadingSection />

      <section className="mb-10">
        <SectionHeader title="Latest Update" href="/list" />
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {latestUpdate.map(manga => (
            <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
              <MangaCard manga={manga} />
            </div>
          ))}
        </div>
      </section>

      <HorizontalSection title="Top Rated Manga" href="/list?type=Manga&sort=rating" items={topManga} />
      <HorizontalSection title="Top Rated Manhwa" href="/list?type=Manhwa&sort=rating" items={topManhwa} />
      <HorizontalSection title="Top Rated Manhua" href="/list?type=Manhua&sort=rating" items={topManhua} />

      <section>
        <SectionHeader title="New Arrivals" href="/list?sort=create" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {newArrivals.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      </section>
    </div>
  )
}
