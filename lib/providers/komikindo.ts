const BASE = 'https://komikindo.ch/wp-json'

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://komikindo.ch/',
}

type KomikindoPost = { id: number }
type KomikindoChapterResponse = { image?: string[] }

// Patched chapters are served from komikindo.ch, never Kiryuu — see
// docs/superpowers/specs/2026-07-21-komikindo-gap-patch-design.md.
// komikindo has no dedicated chapter post type: a chapter's post ID must be
// resolved by exact slug first, then its images fetched via a separate
// custom endpoint. Any failure at either step returns [] — a patched
// chapter going missing must degrade the same as any other 404, never
// break the page.
export async function fetchKomikindoChapterPages(chapterSlug: string): Promise<string[]> {
  try {
    const postRes = await fetch(
      `${BASE}/wp/v2/posts?slug=${encodeURIComponent(chapterSlug)}&_fields=id`,
      { headers: HEADERS }
    )
    if (!postRes.ok) return []
    const posts = await postRes.json() as KomikindoPost[]
    if (!posts[0]) return []

    const chapterRes = await fetch(`${BASE}/apk/v2/chapter/${posts[0].id}`, { headers: HEADERS })
    if (!chapterRes.ok) return []
    const data = await chapterRes.json() as KomikindoChapterResponse
    return data.image ?? []
  } catch {
    return []
  }
}
