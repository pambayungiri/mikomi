export default function SearchLoading() {
  return (
    <div>
      <div className="h-6 w-20 rounded bg-surface-2 animate-pulse mb-4" />
      <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
      <div className="flex gap-2 mt-3">
        {[60, 70, 80, 80].map((w, i) => (
          <div key={i} className="h-8 rounded-full bg-surface-2 animate-pulse" style={{ width: w }} />
        ))}
      </div>
    </div>
  )
}
