'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <svg className="text-muted mb-4" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2 className="text-lg font-bold text-fg mb-2">Something went wrong</h2>
      <p className="text-muted text-sm mb-6 max-w-sm">Failed to load content. This might be a network issue — try again.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Try again
        </button>
        <Link href="/" className="px-4 py-2 rounded-lg bg-surface-2 text-muted text-sm font-medium hover:text-fg transition-colors">
          Go home
        </Link>
      </div>
    </div>
  )
}
