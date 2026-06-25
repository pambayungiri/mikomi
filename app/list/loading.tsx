import { MangaCardSkeletonGrid } from '@/components/MangaCardSkeleton'

export default function ListLoading() {
  return (
    <div>
      <div className="h-7 w-20 rounded bg-surface-2 animate-pulse mb-4" />

      {/* Filter bar skeleton — matches new 1-row design */}
      <div className="mb-6 flex items-center gap-2 overflow-hidden">
        {[60, 72, 88, 84].map((w, i) => (
          <div key={i} className="h-9 rounded-lg bg-surface-2 animate-pulse flex-shrink-0" style={{ width: w }} />
        ))}
        <div className="flex-1" />
        <div className="h-9 w-24 rounded-lg bg-surface-2 animate-pulse flex-shrink-0" />
        <div className="h-9 w-20 rounded-lg bg-surface-2 animate-pulse flex-shrink-0" />
      </div>

      <MangaCardSkeletonGrid count={18} />
    </div>
  )
}
