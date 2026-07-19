import { NextRequest } from 'next/server'
import { isProxiedHost } from '@/lib/proxy'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('missing url', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response('invalid url', { status: 400 })
  }

  if (!isProxiedHost(parsed.hostname)) {
    return new Response('host not allowed', { status: 403 })
  }

  // Same-site referer for kiryuu hosts; the CDNs expect the kiryuu site as referer
  const referer = parsed.hostname.endsWith('.kiryuu.to') ? `${parsed.origin}/` : 'https://v7.kiryuu.to/'

  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9',
      'Referer': referer,
    },
    next: { revalidate: 86400 },
  }).catch(() => null)

  if (!upstream || !upstream.ok) {
    // Return placeholder on failure
    return Response.redirect(new URL('/placeholder-cover.jpg', req.url))
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg'
  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
