'use client'

import { useEffect, useState } from 'react'

const KEY = 'mikomi_bookmarks'

export default function BookmarkIndicator({ slug }: { slug: string }) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    function check() {
      try {
        const data: { slug: string }[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
        setBookmarked(data.some(b => b.slug === slug))
      } catch { setBookmarked(false) }
    }
    check()
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [slug])

  if (!bookmarked) return null

  return (
    <span className="absolute top-1.5 right-1.5 z-10">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#7c6aff" stroke="#7c6aff" strokeWidth="1.5">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
  )
}
