export default function ChapterLoading() {
  return (
    <div>
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-32 rounded bg-surface-2 animate-pulse" />
        <div className="h-4 w-12 rounded bg-surface-2 animate-pulse" />
        <div className="h-7 w-20 rounded-full bg-surface-2 animate-pulse" />
      </div>

      {/* Page skeletons — same aspect ratio the reader uses */}
      <div className="flex flex-col items-center gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full max-w-2xl aspect-[2/3] bg-surface-2 animate-pulse rounded" />
        ))}
      </div>
    </div>
  )
}
