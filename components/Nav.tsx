import Link from 'next/link'

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-accent">
          Mikomi
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/list" className="text-muted hover:text-fg transition-colors">Browse</Link>
          <Link href="/bookmark" className="text-muted hover:text-fg transition-colors">Bookmark</Link>
          <Link href="/history" className="text-muted hover:text-fg transition-colors">History</Link>
          <Link href="/search" className="text-muted hover:text-fg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </Link>
        </nav>
      </div>
    </header>
  )
}
