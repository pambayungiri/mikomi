// Kiryuu rotates its site domain (v4 → v5 → v6 → v7 …), so match any version.
const KIRYUU_HOST = /^v\d+\.kiryuu\.to$/
// Chapter page images are served from these CDNs, which also reject cross-site hotlinking.
const CDN_HOSTS = ['yuucdn.com', 'cdn.uqni.net']

export function isProxiedHost(hostname: string): boolean {
  if (KIRYUU_HOST.test(hostname)) return true
  return CDN_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h))
}

export function proxyUrl(url: string): string {
  if (!url) return '/placeholder-cover.jpg'
  try {
    const { hostname } = new URL(url)
    if (isProxiedHost(hostname)) {
      return `/api/cover?url=${encodeURIComponent(url)}`
    }
  } catch {
    // fall through
  }
  return url
}
