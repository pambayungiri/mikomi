import { MangaCardSkeletonGrid } from '@/components/MangaCardSkeleton'

export default function ListLoading() {
  return (
    <div>
      <div className="h-6 w-24 rounded bg-surface-2 animate-pulse mb-4" />

      {/* Filter skeleton */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          {[80, 110, 100, 90].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-surface-2 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="flex gap-2">
          {[70, 80, 80].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-surface-2 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[60, 70, 80, 65, 90, 55, 75, 85, 100, 60, 70].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-surface-2 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>

      <MangaCardSkeletonGrid count={18} />
    </div>
  )
}
