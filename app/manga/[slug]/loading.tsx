export default function MangaDetailLoading() {
  return (
    <div className="md:flex gap-8">
      {/* Sidebar skeleton */}
      <aside className="md:w-52 flex-shrink-0">
        <div className="w-full aspect-[2/3] rounded-xl bg-surface-2 animate-pulse mb-4" />
        <div className="h-10 rounded-lg bg-surface-2 animate-pulse mb-4" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-surface-2 animate-pulse mb-1" />
              <div className="h-4 w-24 rounded bg-surface-2 animate-pulse" />
            </div>
          ))}
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1 min-w-0 mt-6 md:mt-0">
        <div className="h-7 w-64 rounded bg-surface-2 animate-pulse mb-2" />
        <div className="h-4 w-40 rounded bg-surface-2 animate-pulse mb-3" />
        <div className="flex gap-2 mb-4">
          {[50, 60, 70, 55, 65].map((w, i) => (
            <div key={i} className="h-6 rounded bg-surface-2 animate-pulse" style={{ width: w }} />
          ))}
        </div>
        <div className="space-y-2 mb-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-3.5 rounded bg-surface-2 animate-pulse" style={{ width: i === 4 ? '60%' : '100%' }} />
          ))}
        </div>
        <div className="flex gap-3 mb-8">
          <div className="h-10 w-32 rounded-lg bg-surface-2 animate-pulse" />
          <div className="h-10 w-32 rounded-lg bg-surface-2 animate-pulse" />
        </div>
        <div className="h-5 w-28 rounded bg-surface-2 animate-pulse mb-3" />
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-surface-2 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
