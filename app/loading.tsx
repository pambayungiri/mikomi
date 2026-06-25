import { MangaCardSkeletonGrid, MangaCardSkeletonRow } from '@/components/MangaCardSkeleton'

function SectionSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 rounded bg-surface-2 animate-pulse" />
        <div className="h-4 w-14 rounded bg-surface-2 animate-pulse" />
      </div>
      {wide
        ? <MangaCardSkeletonGrid count={5} />
        : <MangaCardSkeletonRow count={6} />
      }
    </div>
  )
}

export default function HomeLoading() {
  return (
    <div>
      {/* Hero carousel skeleton */}
      <div className="rounded-xl h-64 md:h-96 mb-10 bg-surface-2 animate-pulse" />

      {/* Continue Reading */}
      <div className="mb-6">
        <div className="h-5 w-36 rounded bg-surface-2 animate-pulse mb-3" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-shrink-0 w-24 h-32 rounded-lg bg-surface-2 animate-pulse" />
          ))}
        </div>
      </div>

      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton />
      <SectionSkeleton wide />
    </div>
  )
}
