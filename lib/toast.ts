export type ToastType = 'success' | 'info' | 'error'

export function showToast(message: string, type: ToastType = 'success'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('mikomi-toast', { detail: { message, type } })
  )
}
