export function proxyUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('/')) return url // already relative or proxy path
  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}
