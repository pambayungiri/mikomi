import type {
  MangaCard, MangaDetail, ChapterDetail, ChapterMeta,
  PaginatedResult, MangaProvider,
} from './types'

const BASE = 'https://v6.kiryuu.to/wp-json/wp/v2'

// Cloudflare blocks requests without a browser User-Agent from data-center IPs
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, */*',
}

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
  content?: { rendered: string }
}

type WPTaxTerm = { id: number; name: string; slug: string }

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

async function kfetch<T>(url: string, revalidate = 300): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate } })
  if (!res.ok) throw new Error(`Kiryuu ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

function parseMangaCard(m: WPManga): MangaCard {
  return {
    id:            String(m.id),
    slug:          m.slug,
    name:          decodeHtml(m.title.rendered),
    type:          firstTerm('type', m._embedded) || 'Manga',
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

  private mangaListUrl(params: Record<string, string | number>): string {
    const sp = new URLSearchParams({ _embed: 'wp:featuredmedia,wp:term' })
    for (const [k, v] of Object.entries(params)) sp.set(k, String(v))
    return `${BASE}/manga?${sp}`
  }

  private async fetchMangaList(
    params: Record<string, string | number>,
    revalidate = 300
  ): Promise<WPManga[]> {
    return kfetch<WPManga[]>(this.mangaListUrl(params), revalidate)
  }

  // Fetch semua chapters untuk satu manga (parallel pages)
  private async fetchChapters(mangaSlug: string): Promise<ChapterMeta[]> {
    const prefix  = `${mangaSlug}-chapter-`
    const perPage = 100

    const parseChap = (ch: WPChapter): ChapterMeta | null => {
      if (!ch.slug.startsWith(prefix)) return null
      const num = parseFloat(ch.slug.slice(prefix.length))
      return isNaN(num) ? null : { number: num, updatedAt: ch.date, note: '' }
    }

    const chapterUrl = (page: number) =>
      `${BASE}/chapter?search=${encodeURIComponent(mangaSlug)}&per_page=${perPage}&page=${page}&orderby=date&order=asc&_fields=id,slug,date`

    // Fetch halaman pertama untuk dapat total
    const firstRes = await fetch(chapterUrl(1), { headers: HEADERS, next: { revalidate: 1800 } })
    if (!firstRes.ok) return []

    const total = parseInt(firstRes.headers.get('X-WP-Total') ?? '0', 10)
    if (total === 0) return []

    const firstBatch = (await firstRes.json() as WPChapter[])
    const chapters: ChapterMeta[] = firstBatch
      .map(parseChap).filter((c): c is ChapterMeta => c !== null)

    // Fetch sisa halaman secara paralel
    const totalPages = Math.ceil(total / perPage)
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetch(chapterUrl(i + 2), { headers: HEADERS, next: { revalidate: 1800 } })
            .then(r => r.ok ? r.json() as Promise<WPChapter[]> : [])
            .then(batch => batch.map(parseChap).filter((c): c is ChapterMeta => c !== null))
        )
      )
      for (const batch of rest) chapters.push(...batch)
    }

    // Sort desc — chapter terbaru di atas (sesuai tampilan UI)
    return chapters.sort((a, b) => b.number - a.number)
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
    if (!res.ok) throw new Error(`Kiryuu getList ${res.status}`)

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
    const list = await this.fetchMangaList({ slug, per_page: 1 }, 3600)
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
    const chSlug = `${slug}-chapter-${chapter}`

    // Fetch chapter content + manga info + prev/next — semua paralel
    const [chapterList, mangaList, prevList, nextList] = await Promise.all([
      kfetch<WPChapter[]>(
        `${BASE}/chapter?slug=${encodeURIComponent(chSlug)}&_fields=content`,
        86400
      ),
      kfetch<WPManga[]>(
        `${BASE}/manga?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia&_fields=id,title,_embedded,_links`,
        3600
      ),
      chapter > 1
        ? kfetch<WPChapter[]>(`${BASE}/chapter?slug=${encodeURIComponent(`${slug}-chapter-${chapter - 1}`)}&_fields=id`, 86400)
        : Promise.resolve([] as WPChapter[]),
      kfetch<WPChapter[]>(
        `${BASE}/chapter?slug=${encodeURIComponent(`${slug}-chapter-${chapter + 1}`)}&_fields=id`,
        86400
      ),
    ])

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
      prev: prevList.length > 0 ? chapter - 1 : null,
      next: nextList.length > 0 ? chapter + 1 : null,
    }
  }

  async search(query: string, opts?: { type?: string }): Promise<MangaCard[]> {
    if (!query.trim()) return []
    const params: Record<string, string | number> = { search: query.trim(), per_page: 12 }
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
