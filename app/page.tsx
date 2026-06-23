import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import HeroCarousel from '@/components/HeroCarousel'

export const revalidate = 3600

export default async function HomePage() {
  const provider = getProvider()
  const [popular, latestUpdate, newArrivals] = await Promise.all([
    provider.getPopular(),
    provider.getLatestUpdate(),
    provider.getNewArrivals(),
  ])

  return (
    <div>
      <HeroCarousel items={popular} />

      <section className="mb-10">
        <h2 className="text-lg font-bold text-fg mb-4">Latest Update</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {latestUpdate.map(manga => (
            <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
              <MangaCard manga={manga} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-fg mb-4">New Arrivals</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {newArrivals.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      </section>
    </div>
  )
}
