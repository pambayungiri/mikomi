'use client'

import { useEffect, useState } from 'react'
import type { ToastType } from '@/lib/toast'

type Toast = { id: number; message: string; type: ToastType }

export default function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    function handle(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      setToast({ id: Date.now(), message, type })
    }
    window.addEventListener('mikomi-toast', handle)
    return () => window.removeEventListener('mikomi-toast', handle)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast?.id])

  if (!toast) return null

  const accentClass = {
    success: 'text-accent',
    info:    'text-muted',
    error:   'text-accent-2',
  }[toast.type]

  const icon = { success: '✓', info: 'ℹ', error: '✕' }[toast.type]

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 right-4 z-[200] flex items-center gap-2.5 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-sm text-fg"
    >
      <span className={`font-bold ${accentClass}`} aria-hidden="true">{icon}</span>
      {toast.message}
    </div>
  )
}
