import type {
  MangaCard, MangaDetail, ChapterDetail, ChapterMeta,
  PaginatedResult, MangaProvider,
} from './types'

// If KIRYUU_BASE is set, requests go through a CF Worker relay instead of directly to
// v7.kiryuu.to. Required on Vercel — Cloudflare blocks AWS datacenter IPs by ASN.
const BASE = process.env.KIRYUU_BASE ?? 'https://v7.kiryuu.to/wp-json/wp/v2'
const RELAY_KEY = process.env.KIRYUU_RELAY_KEY ?? ''

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://v7.kiryuu.to/',
  // No Cache-Control/Pragma no-cache here: Vercel's Data Cache treats them as a
  // bypass signal on outbound fetches, defeating next.revalidate entirely.
}
if (RELAY_KEY) HEADERS['x-relay-key'] = RELAY_KEY

// Taxonomy IDs untuk filter per type
const TYPE_IDS: Record<string, number> = {
  Manga:   8683,
  Manhwa:  8679,
  Manhua:  8687,
}

// ─── WP API Types ─────────────────────────────────────────────────────────────

type WPTerm  = { id: number; name: string; taxonomy: string }
type WPMedia = { source_url: string }

type WPManga = {
  id: number
  slug: string
  title: { rendered: string }
  excerpt: { rendered: string }
  modified: string
  'manga-type'?: number[]
  metadata?: { meta?: { released?: string; score?: string; alternative_title?: string } }
  _embedded?: {
    'wp:featuredmedia'?: WPMedia[]
    'wp:term'?: WPTerm[][]
  }
}

type WPChapter = {
  id: number
  slug: string
  date: string
  title?: { rendered: string }
  content?: { rendered: string }
}

type WPTaxTerm = { id: number; name: string; slug: string }

// Internal-only: carries the exact WP slug alongside the parsed chapter number,
// so getChapter can fetch content by real slug instead of guessing one.
type ChapterMetaWithSlug = ChapterMeta & { slug: string }

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–').replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
}

function stripHtml(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, '')).trim()
}

function termsOf(taxonomy: string, embedded?: WPManga['_embedded']): string[] {
  if (!embedded?.['wp:term']) return []
  for (const group of embedded['wp:term']) {
    if (group.length > 0 && group[0].taxonomy === taxonomy)
      return group.map(t => t.name)
  }
  return []
}

function firstTerm(taxonomy: string, embedded?: WPManga['_embedded']): string {
  return termsOf(taxonomy, embedded)[0] ?? ''
}

function coverOf(embedded?: WPManga['_embedded']): string {
  return embedded?.['wp:featuredmedia']?.[0]?.source_url ?? ''
}

function parseImages(html: string): string[] {
  const imgs: string[] = []
  const re = /<img[^>]+src=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1] && !m[1].includes('data:image')) imgs.push(m[1])
  }
  return imgs
}

// Parses the chapter number out of a chapter slug: leading digits, optionally
// followed by "-digits" for a WP-slugified decimal sub-chapter (9.1 → "9-1").
// Anything after that is ignored rather than rejected — scanlators repost
// corrected chapters with a suffix ("…-chapter-59-fix", or inconsistently
// "…-chapter-208fix"), and a strict full-string match used to silently drop
// these chapters from the reader entirely (they'd vanish as a numbering gap
// and 404 if you tried to open them directly).
export function chapterNumberFromSlug(slug: string, prefix: string): number | null {
  if (!slug.startsWith(prefix)) return null
  const raw = slug.slice(prefix.length)
  const m = raw.match(/^(\d+)(?:-(\d+))?/)
  if (!m) return null
  return m[2] ? parseFloat(`${m[1]}.${m[2]}`) : Number(m[1])
}

// Extracts the chapter number as Kiryuu's own title text states it
// ("Chapter 160.5" → 160.5). Only the first number is captured, so a
// combined-release title ("Chapter 656-657") yields 656. `\D*?` (not just
// leading zeros) also finds the number when other text sits between "Chapter"
// and the digits ("Chapter ep. 2 – siapa dia?" → 2).
function numberFromChapterTitle(titleText: string): number | null {
  const m = decodeHtml(titleText).match(/Chapter\s+\D*?(\d+(?:\.\d+)?)/i)
  return m ? parseFloat(m[1]) : null
}

// Cross-checks the slug-derived number against the chapter's own title text and
// corrects it for two confirmed, deterministic Kiryuu data patterns (found via a
// full-catalog audit — 789 titles / 5,140 chapters affected):
//
// 1. Dash-dropped decimal: some sub-chapters get slugged by concatenating the
//    decimal digits instead of separating them ("…chapter-1605" whose title
//    reads "Chapter 160.5" — should have been "…chapter-160-5"). The slug then
//    parses as a plausible-looking, but wrong, integer (1605). Detected by:
//    slugNum is an integer, titleNum has a fractional part, and slugNum equals
//    titleNum's digits with the decimal point removed.
// 2. Combined-release range: a title like "Chapter 656-657" bundles two
//    chapters into one post. The slug's dash there means "range", not
//    "decimal point" — chapterNumberFromSlug's normal sub-chapter rule
//    misreads "656-657" as 656.657. Corrected to the first number (656).
//    Only triggers when the slug's normal decimal parse is implausible (a
//    multi-digit fraction) — a title like "Chapter 1-1"/"Chapter 1-2" marks
//    part 1/part 2 of chapter 1, not a range, and a plausible single-digit
//    fraction (1.1, 1.2) must be left alone or both posts collapse to
//    chapter "1" and one silently overwrites the other.
//
// Any other disagreement (title vs. slug) is a site-side data error with no
// reliable signal for which number is correct — left as the slug value rather
// than guessed.
export function reconcileChapterNumber(slugNum: number, titleText: string): number {
  const titleNum = numberFromChapterTitle(titleText)
  if (titleNum === null || titleNum === slugNum) return slugNum

  if (/Chapter\s+\d+\s*[-–]\s*\d+/i.test(titleText)) {
    const fracDigits = String(slugNum).split('.')[1]?.length ?? 0
    if (fracDigits > 1) return titleNum
  }

  if (Number.isInteger(slugNum) && titleNum % 1 !== 0) {
    const frac = Math.round((titleNum % 1) * 10)
    const wholeAndFrac = Math.floor(titleNum) * 10 + frac
    if (slugNum === wholeAndFrac) return titleNum
  }

  return slugNum
}

// WP full-text search scans titles/content only — the hyphenated manga slug matches
// chapter content just because old-CDN image URLs embed it. New-CDN uploads
// (cdn.uqni.net, hashed paths) don't, so slug search finds nothing. These tokens
// match chapter TITLES instead: contraction tokens (I’m, I’ll) are dropped because
// MySQL LIKE can't match across the apostrophe, and tokens under 3 chars are too
// generic — one unmatched token fails the whole AND'd search.
export function titleSearchTerms(title: string): string {
  return title
    .split(/\s+/)
    .filter(t => !/['’]/.test(t))
    .map(t => t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, ''))
    .filter(t => t.length >= 3)
    .slice(0, 8) // WP switches to exact-phrase matching past 9 terms — long titles would return 0
    .join(' ')
}

async function kfetch<T>(url: string, revalidate = 300): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate } })
  if (!res.ok) throw new Error(`Kiryuu ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

const TYPE_BY_ID: Record<number, string> = Object.fromEntries(
  Object.entries(TYPE_IDS).map(([name, id]) => [id, name])
)

function parseMangaCard(m: WPManga): MangaCard {
  const typeId = m['manga-type']?.[0]
  return {
    id:            String(m.id),
    slug:          m.slug,
    name:          decodeHtml(m.title.rendered),
    type:          (typeId && TYPE_BY_ID[typeId]) || firstTerm('type', m._embedded) || 'Manga',
    image:         coverOf(m._embedded),
    latestChapter: null,
    updatedAt:     m.modified,
  }
}

// ─── Genre map (lazy, cached per deploy) ──────────────────────────────────────

let genreMapCache: Map<string, number> | null = null

// ─── Title index for fuzzy search fallback ────────────────────────────────────

let titleIndexCache: { slug: string; name: string }[] | null = null

async function buildTitleIndex(): Promise<{ slug: string; name: string }[]> {
  if (titleIndexCache) return titleIndexCache
  // Top 500 manga by modified date — covers most-searched titles without fetching all 8794
  const pages = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      kfetch<WPManga[]>(
        `${BASE}/manga?per_page=100&page=${i + 1}&orderby=modified&order=desc&_fields=id,slug,title`,
        86400
      ).catch(() => [] as WPManga[])
    )
  )
  titleIndexCache = pages.flat().map(m => ({
    slug: m.slug,
    name: decodeHtml(m.title.rendered),
  }))
  return titleIndexCache
}

async function getGenreMap(): Promise<Map<string, number>> {
  if (genreMapCache) return genreMapCache
  const terms = await kfetch<WPTaxTerm[]>(
    `${BASE}/genre?per_page=100&_fields=id,name,slug`,
    86400
  )
  genreMapCache = new Map(terms.map(t => [t.name.toLowerCase(), t.id]))
  return genreMapCache
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class KiryuuProvider implements MangaProvider {

  // Slim by default: full wp:term embeds carry each term's Yoast SEO blob
  // (~40KB per manga — a 24-item list breaks Next's 2MB data-cache limit).
  // Cards only need the type, which manga-type IDs provide for free.
  private mangaListUrl(params: Record<string, string | number>, full = false): string {
    const sp = full
      ? new URLSearchParams({ _embed: 'wp:featuredmedia,wp:term' })
      : new URLSearchParams({
          _embed: 'wp:featuredmedia',
          _fields: 'id,slug,title,modified,manga-type,_links.wp:featuredmedia,_embedded',
        })
    for (const [k, v] of Object.entries(params)) sp.set(k, String(v))
    return `${BASE}/manga?${sp}`
  }

  private async fetchMangaList(
    params: Record<string, string | number>,
    revalidate = 300,
    full = false
  ): Promise<WPManga[]> {
    return kfetch<WPManga[]>(this.mangaListUrl(params, full), revalidate)
  }

  // Fetch semua chapters untuk satu manga (parallel pages).
  // Fast path: chapter titles embed the manga name, and a title-column-only
  // search runs ~13x faster than WP's default title+content scan (content rows
  // are huge — they hold the page-image HTML for 450k chapters).
  private async fetchChapters(mangaSlug: string): Promise<ChapterMetaWithSlug[]> {
    const prefix = `${mangaSlug}-chapter-`

    const m = await kfetch<WPManga[]>(
      `${BASE}/manga?slug=${encodeURIComponent(mangaSlug)}&per_page=1&_fields=title`,
      3600
    ).catch(() => [] as WPManga[])
    const terms = m[0] ? titleSearchTerms(decodeHtml(m[0].title.rendered)) : ''

    if (terms) {
      const viaTitle = await this.searchChapters(terms, prefix, 'post_title')
      if (viaTitle.length > 0) return viaTitle
    }

    // Fallback: full search by slug — matches old-CDN chapter content
    return this.searchChapters(mangaSlug, prefix)
  }

  private async searchChapters(searchTerm: string, prefix: string, searchColumns?: string): Promise<ChapterMetaWithSlug[]> {
    const perPage = 100

    const parseChap = (ch: WPChapter): ChapterMetaWithSlug | null => {
      const slugNum = chapterNumberFromSlug(ch.slug, prefix)
      if (slugNum === null) {
        // Some slugs bury the number after other text ("…chapter-ep-2-siapa-dia")
        // instead of leading with it — the chapter's own title still states
        // the number unambiguously.
        const titleOnly = numberFromChapterTitle(ch.title?.rendered ?? '')
        return titleOnly === null ? null : { number: titleOnly, updatedAt: ch.date, note: '', slug: ch.slug }
      }
      const num = reconcileChapterNumber(slugNum, ch.title?.rendered ?? '')
      return { number: num, updatedAt: ch.date, note: '', slug: ch.slug }
    }

    const columns = searchColumns ? `&search_columns=${searchColumns}` : ''
    const chapterUrl = (page: number) =>
      `${BASE}/chapter?search=${encodeURIComponent(searchTerm)}${columns}&per_page=${perPage}&page=${page}&orderby=date&order=asc&_fields=id,slug,date,title`

    // Fetch halaman pertama untuk dapat total
    const firstRes = await fetch(chapterUrl(1), { headers: HEADERS, next: { revalidate: 1800 } })
    if (!firstRes.ok) return []

    const total = parseInt(firstRes.headers.get('X-WP-Total') ?? '0', 10)
    if (total === 0) return []

    const firstBatch = (await firstRes.json() as WPChapter[])
    const chapters: ChapterMetaWithSlug[] = firstBatch
      .map(parseChap).filter((c): c is ChapterMetaWithSlug => c !== null)

    // Fetch sisa halaman secara paralel
    const totalPages = Math.ceil(total / perPage)
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetch(chapterUrl(i + 2), { headers: HEADERS, next: { revalidate: 1800 } })
            .then(r => r.ok ? r.json() as Promise<WPChapter[]> : [])
            .then(batch => batch.map(parseChap).filter((c): c is ChapterMetaWithSlug => c !== null))
        )
      )
      for (const batch of rest) chapters.push(...batch)
    }

    // Same number can appear twice when a scanlator reposts a corrected chapter
    // under a suffixed slug ("…chapter-59" + "…chapter-59-fix") — keep whichever
    // was posted most recently; the repost supersedes the original.
    const byNumber = new Map<number, ChapterMetaWithSlug>()
    for (const c of chapters) {
      const existing = byNumber.get(c.number)
      if (!existing || c.updatedAt > existing.updatedAt) byNumber.set(c.number, c)
    }

    // Sort desc — chapter terbaru di atas (sesuai tampilan UI)
    return [...byNumber.values()].sort((a, b) => b.number - a.number)
  }

  // ─── Interface methods ────────────────────────────────────────────────────

  async getPopular(): Promise<MangaCard[]> {
    const list = await this.fetchMangaList({ per_page: 12, orderby: 'modified', order: 'desc' })
    return list.map(parseMangaCard)
  }

  async getLatestUpdate(): Promise<MangaCard[]> {
    // Offset 12 supaya tidak tampil manga yang sama dengan getPopular di homepage
    const list = await this.fetchMangaList({ per_page: 12, offset: 12, orderby: 'modified', order: 'desc' })
    return list.map(parseMangaCard)
  }

  async getNewArrivals(): Promise<MangaCard[]> {
    const list = await this.fetchMangaList({ per_page: 12, orderby: 'date', order: 'desc' })
    return list.map(parseMangaCard)
  }

  async getPopularByType(type: string): Promise<MangaCard[]> {
    const typeId = TYPE_IDS[type]
    if (!typeId) return []
    const list = await this.fetchMangaList({
      per_page: 8, 'manga-type': typeId, orderby: 'modified', order: 'desc',
    })
    return list.map(parseMangaCard)
  }

  async getTopRatedByType(type: string): Promise<MangaCard[]> {
    const typeId = TYPE_IDS[type]
    if (!typeId) return []
    // WP REST API tidak support rating sort — pakai date (manga terbaru per type)
    const list = await this.fetchMangaList({
      per_page: 8, 'manga-type': typeId, orderby: 'date', order: 'desc',
    })
    return list.map(parseMangaCard)
  }

  async getList(opts: {
    genre?: string
    sort?:  'update' | 'create' | 'rating'
    type?:  string
    after?: string
  }): Promise<PaginatedResult<MangaCard>> {
    const limit  = 24
    const offset = parseInt(opts.after ?? '0', 10) || 0
    const params: Record<string, string | number> = {
      per_page: limit,
      offset,
      orderby: opts.sort === 'create' ? 'date' : 'modified',
      order:   'desc',
    }

    if (opts.type) {
      const typeId = TYPE_IDS[opts.type]
      if (typeId) params['manga-type'] = typeId
    }

    if (opts.genre) {
      const genreMap = await getGenreMap()
      const termId   = genreMap.get(opts.genre.toLowerCase())
      if (termId) params['genre'] = termId
    }

    const sp = new URLSearchParams({ _embed: 'wp:featuredmedia,wp:term' })
    for (const [k, v] of Object.entries(params)) sp.set(k, String(v))
    const res = await fetch(`${BASE}/manga?${sp}`, { headers: HEADERS, next: { revalidate: 300 } })
    if (!res.ok) {
      if (res.status === 403) return { data: [], nextCursor: null, hasMore: false }
      throw new Error(`Kiryuu getList ${res.status}`)
    }

    const total     = parseInt(res.headers.get('X-WP-Total') ?? '0', 10)
    const list      = await res.json() as WPManga[]
    const nextOffset = offset + limit

    return {
      data:       list.map(parseMangaCard),
      nextCursor: nextOffset < total ? String(nextOffset) : null,
      hasMore:    nextOffset < total,
    }
  }

  async getManga(slug: string): Promise<MangaDetail> {
    // Detail page needs genre/author/status names — full term embeds required
    const list = await this.fetchMangaList({ slug, per_page: 1 }, 3600, true)
    if (!list.length) throw new Error(`Manga not found: ${slug}`)
    const m = list[0]

    const chapters = await this.fetchChapters(slug)
    const meta     = m.metadata?.meta ?? {}

    return {
      id:            String(m.id),
      slug:          m.slug,
      name:          decodeHtml(m.title.rendered),
      name2:         meta.alternative_title ?? '',
      type:          firstTerm('type', m._embedded) || 'Manga',
      image:         coverOf(m._embedded),
      latestChapter: chapters.length > 0 ? chapters[0].number : null,
      updatedAt:     m.modified,
      description:   stripHtml(m.excerpt?.rendered ?? ''),
      genre:         termsOf('genre', m._embedded),
      demographic:   [],
      themes:        [],
      author:        firstTerm('series-author', m._embedded),
      artist:        firstTerm('artist', m._embedded),
      rate:          parseFloat(meta.score ?? '0') || 0,
      status:        firstTerm('status', m._embedded) || 'Unknown',
      rilis:         meta.released ?? '',
      chapters,
    }
  }

  async getChapter(slug: string, chapter: number): Promise<ChapterDetail> {
    // Resolve against the real chapter list first, rather than guessing a slug —
    // some chapters are reposted with a non-numeric suffix ("…chapter-59-fix"),
    // so a plain "manga-chapter-59" guess 404s even though the chapter exists.
    const [allChapters, mangaList] = await Promise.all([
      this.fetchChapters(slug),
      kfetch<WPManga[]>(
        `${BASE}/manga?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia&_fields=id,title,_embedded,_links`,
        3600
      ),
    ])

    const nums = allChapters.map(c => c.number) // sorted desc
    const idx  = nums.indexOf(chapter)
    if (idx === -1) throw new Error(`Chapter ${chapter} not found: ${slug}`)
    const target = allChapters[idx]

    const chapterList = await kfetch<WPChapter[]>(
      `${BASE}/chapter?slug=${encodeURIComponent(target.slug)}&_fields=content`,
      86400
    )
    if (!chapterList.length) throw new Error(`Chapter ${chapter} not found: ${slug}`)

    // Gambar langsung dari CDN Kiryuu — tidak ada proxy
    const pages      = parseImages(chapterList[0].content?.rendered ?? '')
    const mangaName  = mangaList[0] ? decodeHtml(mangaList[0].title.rendered) : slug
    const mangaImage = coverOf(mangaList[0]?._embedded)

    return {
      mangaSlug:  slug,
      mangaName,
      mangaImage,
      chapter,
      pages,
      prev: idx < nums.length - 1 ? nums[idx + 1] : null,
      next: idx > 0 ? nums[idx - 1] : null,
    }
  }

  async search(query: string, opts?: { type?: string }): Promise<MangaCard[]> {
    if (!query.trim()) return []
    // Tanpa search_columns, WP juga mencari di deskripsi — query pendek seperti
    // "over" match 182 judul dan mengubur hasil yang benar di luar 12 teratas
    const params: Record<string, string | number> = {
      search: query.trim(), search_columns: 'post_title', per_page: 12,
    }
    if (opts?.type) {
      const typeId = TYPE_IDS[opts.type]
      if (typeId) params['manga-type'] = typeId
    }
    const list = await this.fetchMangaList(params, 60)
    const wpResults = list.map(parseMangaCard)

    // Fuse.js fallback: WP MySQL LIKE search is literal — can't handle typos.
    // Only runs when WP returns 0 results, so the hot path (≥1 WP result) is untouched.
    if (wpResults.length === 0) {
      const { default: Fuse } = await import('fuse.js')
      const index = await buildTitleIndex()
      const fuse = new Fuse(index, {
        keys: ['name'],
        threshold: 0.4,       // 0 = exact match, 1 = match anything — 0.4 handles single-word typos
        minMatchCharLength: 2,
      })
      const matches = fuse.search(query.trim(), { limit: 8 })
      if (matches.length === 0) return []
      const details = await Promise.all(
        matches.map(m =>
          this.fetchMangaList({ slug: m.item.slug, per_page: 1 }, 3600)
            .then(r => (r[0] ? parseMangaCard(r[0]) : null))
            .catch(() => null)
        )
      )
      return details.filter((d): d is MangaCard => d !== null)
    }

    return wpResults
  }

  async getRelated(genre: string, excludeSlug: string): Promise<MangaCard[]> {
    const genreMap = await getGenreMap()
    const termId   = genreMap.get(genre.toLowerCase())
    if (!termId) return []
    const list = await this.fetchMangaList(
      { genre: termId, per_page: 12, orderby: 'modified', order: 'desc' },
      3600
    )
    return list.map(parseMangaCard).filter(m => m.slug !== excludeSlug).slice(0, 8)
  }

  getGenres(): string[] {
    return [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
      'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
      'Supernatural', 'Thriller', 'Isekai', 'Mecha', 'Historical',
    ]
  }
}
