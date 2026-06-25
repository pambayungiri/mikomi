import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import HeroCarousel from '@/components/HeroCarousel'
import ContinueReadingSection from '@/components/ContinueReadingSection'

export const revalidate = 3600

export default async function HomePage() {
  const provider = getProvider()
  const [popular, latestUpdate, newArrivals, popularManhwa, popularManhua] = await Promise.all([
    provider.getPopular(),
    provider.getLatestUpdate(),
    provider.getNewArrivals(),
    provider.getPopularByType('Manhwa'),
    provider.getPopularByType('Manhua'),
  ])

  return (
    <div>
      <HeroCarousel items={popular} />

      {/* Continue Reading — reads localStorage, renders on client */}
      <ContinueReadingSection />

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-fg">Latest Update</h2>
          <a href="/list" className="text-xs text-muted hover:text-accent transition-colors">See All</a>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {latestUpdate.map(manga => (
            <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
              <MangaCard manga={manga} />
            </div>
          ))}
        </div>
      </section>

      {popularManhwa.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-fg">Popular Manhwa</h2>
            <a href="/list?type=Manhwa" className="text-xs text-muted hover:text-accent transition-colors">See All</a>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {popularManhwa.map(manga => (
              <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
                <MangaCard manga={manga} />
              </div>
            ))}
          </div>
        </section>
      )}

      {popularManhua.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-fg">Popular Manhua</h2>
            <a href="/list?type=Manhua" className="text-xs text-muted hover:text-accent transition-colors">See All</a>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {popularManhua.map(manga => (
              <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
                <MangaCard manga={manga} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-fg">New Arrivals</h2>
          <a href="/list?sort=create" className="text-xs text-muted hover:text-accent transition-colors">See All</a>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {newArrivals.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      </section>
    </div>
  )
}
