'use client'

import { useState } from 'react'

export default function ExpandableText({
  text,
  maxLines = 4,
}: {
  text: string
  maxLines?: number
}) {
  const [expanded, setExpanded] = useState(false)

  const lineClamp: Record<number, string> = {
    3: 'line-clamp-3',
    4: 'line-clamp-4',
    5: 'line-clamp-5',
    6: 'line-clamp-6',
  }

  return (
    <div>
      <p className={`text-muted text-sm leading-relaxed ${!expanded ? (lineClamp[maxLines] ?? 'line-clamp-4') : ''}`}>
        {text}
      </p>
      <button
        onClick={() => setExpanded(v => !v)}
        className="text-xs text-accent hover:text-accent/80 transition-colors mt-1"
      >
        {expanded ? 'Show less ↑' : 'Read more ↓'}
      </button>
    </div>
  )
}
