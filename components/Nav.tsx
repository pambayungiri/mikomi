'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV_LINKS = [
  { href: '/list', label: 'Browse' },
  { href: '/bookmark', label: 'Bookmark' },
  { href: '/history', label: 'History' },
]

export default function Nav() {
  const pathname = usePathname()
  const [bookmarkCount, setBookmarkCount] = useState(0)

  useEffect(() => {
    function sync() {
      try {
        const items = JSON.parse(localStorage.getItem('mikomi_bookmarks') ?? '[]')
        setBookmarkCount(Array.isArray(items) ? items.length : 0)
      } catch { /* ignore */ }
    }
    sync()
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [pathname])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-accent">
          Mikomi
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative transition-colors ${isActive(link.href) ? 'text-fg' : 'text-muted hover:text-fg'}`}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
              {link.href === '/bookmark' && bookmarkCount > 0 && (
                <span className="absolute -top-2 -right-3.5 min-w-[16px] h-4 px-0.5 bg-accent text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                  {bookmarkCount > 99 ? '99+' : bookmarkCount}
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/search"
            className={`transition-colors ${isActive('/search') ? 'text-fg' : 'text-muted hover:text-fg'}`}
            aria-label="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </Link>
        </nav>

        {/* Mobile: nothing here — bottom nav handles all navigation */}
      </div>
    </header>
  )
}
