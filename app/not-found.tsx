import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
      <p className="text-7xl font-black text-accent/20 mb-4">404</p>
      <h2 className="text-xl font-bold text-fg mb-2">Page not found</h2>
      <p className="text-muted text-sm mb-8 max-w-sm">The manga or page you&apos;re looking for doesn&apos;t exist or was removed.</p>
      <div className="flex gap-3">
        <Link href="/list" className="px-5 py-2.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
          Browse Manga
        </Link>
        <Link href="/" className="px-5 py-2.5 rounded-full bg-surface-2 text-muted text-sm font-medium hover:text-fg transition-colors">
          Go Home
        </Link>
      </div>
    </div>
  )
}
