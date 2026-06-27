import type { MetadataRoute } from 'next'
import { getProvider } from '@/lib/providers'

export const revalidate = 86400

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mikomi.vercel.app'

const STATIC: MetadataRoute.Sitemap = [
  { url: BASE_URL,                  lastModified: new Date(), changeFrequency: 'daily',  priority: 1   },
  { url: `${BASE_URL}/list`,        lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
  { url: `${BASE_URL}/bookmark`,    lastModified: new Date(), changeFrequency: 'never',  priority: 0.3 },
  { url: `${BASE_URL}/history`,     lastModified: new Date(), changeFrequency: 'never',  priority: 0.3 },
  { url: `${BASE_URL}/offline`,     lastModified: new Date(), changeFrequency: 'never',  priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const provider = getProvider()
    const [{ data: recent }, popular] = await Promise.all([
      provider.getList({ sort: 'update' }),
      provider.getPopular(),
    ])

    // Deduplicate by slug
    const seen = new Set<string>()
    const allManga = [...popular, ...recent].filter(m => !seen.has(m.slug) && seen.add(m.slug))

    const mangaEntries: MetadataRoute.Sitemap = allManga.map(m => ({
      url:             `${BASE_URL}/manga/${m.slug}`,
      lastModified:    m.updatedAt ? new Date(m.updatedAt) : new Date(),
      changeFrequency: 'weekly',
      priority:        0.8,
    }))

    return [...STATIC, ...mangaEntries]
  } catch {
    // If MangaDex is unreachable, return static pages only
    return STATIC
  }
}
