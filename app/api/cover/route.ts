import { NextRequest } from 'next/server'

const ALLOWED_HOSTS = ['v6.kiryuu.to', 'v5.kiryuu.to', 'yuucdn.com', 'cdn.uqni.net']

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new Response('missing url', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response('invalid url', { status: 400 })
  }

  if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    return new Response('host not allowed', { status: 403 })
  }

  const upstream = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9',
      'Referer': 'https://v6.kiryuu.to/',
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
