import { NextResponse } from 'next/server'

// TEMPORARY diagnostic route — remove after the Vercel data-cache investigation.
const BASE = process.env.KIRYUU_BASE ?? 'https://v7.kiryuu.to/wp-json/wp/v2'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const VARIANTS: Record<string, Record<string, string>> = {
  full: {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://v7.kiryuu.to/',
  },
  noAcceptEncoding: {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://v7.kiryuu.to/',
  },
  onlyAcceptEncoding: {
    'User-Agent': UA,
    'Accept-Encoding': 'gzip, deflate, br',
  },
  uaOnly: {
    'User-Agent': UA,
  },
}

export async function GET() {
  const results: Record<string, { ms: number; status: number }> = {}
  for (const [name, headers] of Object.entries(VARIANTS)) {
    const t0 = Date.now()
    const res = await fetch(`${BASE}/chapter?per_page=1&_fields=id&variant=${name}`, {
      headers,
      next: { revalidate: 300 },
    })
    await res.text()
    results[name] = { ms: Date.now() - t0, status: res.status }
  }
  return NextResponse.json(results)
}
