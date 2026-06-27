'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const KEY_PREFIX = 'mikomi_age_'
const EXPLICIT_RATINGS = ['erotica', 'pornographic']

export default function AgeGate({ mangaId, contentRating }: { mangaId: string; contentRating: string }) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!EXPLICIT_RATINGS.includes(contentRating)) {
      setConfirmed(true)
      setMounted(true)
      return
    }
    const already = localStorage.getItem(`${KEY_PREFIX}${mangaId}`) === '1'
    setConfirmed(already)
    setMounted(true)
  }, [mangaId, contentRating])

  if (!mounted || confirmed) return null

  function confirm() {
    localStorage.setItem(`${KEY_PREFIX}${mangaId}`, '1')
    setConfirmed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm mx-4 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
        <h2 className="text-lg font-bold text-fg mb-2">Konten 18+</h2>
        <p className="text-muted text-sm mb-6">
          Konten ini mengandung materi dewasa. Apakah kamu berusia 18 tahun atau lebih?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-border transition-colors"
          >
            Kembali
          </button>
          <button
            onClick={confirm}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/80 transition-colors"
          >
            Ya, saya 18+
          </button>
        </div>
      </div>
    </div>
  )
}
