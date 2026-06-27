const ALLOWED_HOSTNAMES = [
  'uploads.mangadex.org',
  'mangadex.network',
]

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  const allowed = ALLOWED_HOSTNAMES.some(h =>
    parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
  )
  if (!allowed) return new Response('Forbidden', { status: 403 })

  try {
    const upstream = await fetch(url, { next: { revalidate: 86400 } })
    if (!upstream.ok) return new Response('Upstream error', { status: 502 })

    return new Response(upstream.body, {
      headers: {
        'Content-Type':              upstream.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control':             'public, max-age=86400, immutable',
        'X-Content-Type-Options':    'nosniff',
      },
    })
  } catch {
    return new Response('Fetch failed', { status: 502 })
  }
}
