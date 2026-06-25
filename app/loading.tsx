import { MangaCardSkeletonGrid, MangaCardSkeletonRow } from '@/components/MangaCardSkeleton'

export default function HomeLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <div className="rounded-xl h-72 md:h-96 mb-10 bg-surface-2 animate-pulse" />

      {/* Latest Update skeleton */}
      <div className="mb-10">
        <div className="h-5 w-36 rounded bg-surface-2 animate-pulse mb-4" />
        <MangaCardSkeletonRow count={6} />
      </div>

      {/* New Arrivals skeleton */}
      <div>
        <div className="h-5 w-32 rounded bg-surface-2 animate-pulse mb-4" />
        <MangaCardSkeletonGrid count={10} />
      </div>
    </div>
  )
}
