// Direct URL — no proxy. Kiryuu CDN (yuucdn.com, cdn.uqni.net) accessible langsung.
export function proxyUrl(url: string): string {
  if (!url) return '/placeholder-cover.jpg'
  return url
}
