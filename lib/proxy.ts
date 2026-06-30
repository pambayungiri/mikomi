const KIRYUU_HOSTS = ['v6.kiryuu.to', 'v5.kiryuu.to', 'v4.kiryuu.to']

export function proxyUrl(url: string): string {
  if (!url) return '/placeholder-cover.jpg'
  try {
    const { hostname } = new URL(url)
    if (KIRYUU_HOSTS.includes(hostname)) {
      return `/api/cover?url=${encodeURIComponent(url)}`
    }
  } catch {
    // fall through
  }
  return url
}
