import { NextResponse } from 'next/server'

// TEMPORARY diagnostic route — remove after the Vercel data-cache investigation.
const BASE = process.env.KIRYUU_BASE ?? 'https://v7.kiryuu.to/wp-json/wp/v2'

export async function GET() {
  const t0 = Date.now()
  const neutral = await fetch('https://example.com/', { next: { revalidate: 300 } })
  await neutral.text()
  const t1 = Date.now()

  const up = await fetch(`${BASE}/chapter?per_page=1&_fields=id`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    next: { revalidate: 300 },
  })
  const upstreamHeaders: Record<string, string> = {}
  up.headers.forEach((v, k) => {
    upstreamHeaders[k] = v.length > 80 ? v.slice(0, 80) + '…' : v
  })
  await up.text()
  const t2 = Date.now()

  return NextResponse.json({
    neutralMs: t1 - t0,
    upstreamMs: t2 - t1,
    upstreamStatus: up.status,
    upstreamHeaders,
    baseHostPrefix: BASE.replace(/^https:\/\//, '').slice(0, 10),
  })
}
