import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mikomi.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/list`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/bookmark`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/history`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/offline`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
  ]
}
