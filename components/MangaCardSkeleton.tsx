export default function MangaCardSkeleton() {
  return (
    <div>
      <div className="aspect-[2/3] rounded-lg bg-surface-2 animate-pulse" />
      <div className="mt-1.5 h-3 rounded bg-surface-2 animate-pulse" />
      <div className="mt-1 h-2.5 rounded bg-surface-2 animate-pulse w-2/3" />
    </div>
  )
}

export function MangaCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <MangaCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function MangaCardSkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-32 md:w-36">
          <MangaCardSkeleton />
        </div>
      ))}
    </div>
  )
}
