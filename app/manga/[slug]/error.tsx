'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function MangaError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  const params = useParams()
  const slug = params?.slug as string | undefined

  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center px-4">
      <p className="text-7xl font-black text-accent/20 mb-4">404</p>
      <h2 className="text-xl font-bold text-fg mb-2">Manga not found</h2>
      <p className="text-muted text-sm mb-2 max-w-sm">
        {slug ? `"${slug}" doesn't exist or was removed.` : 'This manga was not found.'}
      </p>
      <p className="text-muted/60 text-xs mb-8">It might have been moved or the link is incorrect.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-surface-2 text-muted text-sm font-medium hover:text-fg transition-colors"
        >
          Try again
        </button>
        <Link href="/list" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
          Browse Manga
        </Link>
      </div>
    </div>
  )
}
