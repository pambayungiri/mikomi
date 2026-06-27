import type {
  MangaCard, MangaDetail, ChapterDetail, ChapterMeta,
  PaginatedResult, MangaProvider,
} from './types'
import { slugRegistry } from './mangadex-slug'

const MDEX = 'https://api.mangadex.org'
// erotica/pornographic require MangaDex auth — omit from unauthenticated server calls
const CONTENT_RATINGS = ['safe', 'suggestive', 'mature']

// ─── MangaDex API types ──────────────────────────────────────────────────────

type MDexRelationship = {
  type: string
  id: string
  attributes?: { name?: string; fileName?: string }
}

type MDexTag = {
  id: string
  attributes: { name: Record<string, string>; group: string }
}

type MDexManga = {
  id: string
  attributes: {
    title: Record<string, string>
    altTitles: Record<string, string>[]
    description: Record<string, string>
    status: string
    year: number | null
    contentRating: string
    originalLanguage: string
    lastChapter: string | null
    updatedAt: string
    rating: { average: number | null; bayesian: number | null }
    tags: MDexTag[]
  }
  relationships: MDexRelationship[]
}

type MDexChapter = {
  id: string
  attributes: {
    chapter: string | null
    title: string | null
    translatedLanguage: string
    pages: number
    updatedAt: string
  }
}

type MDexListResponse  = { data: MDexManga[]; total: number }
type MDexFeedResponse  = { data: MDexChapter[]; total: number }
type MDexAtHome        = { baseUrl: string; chapter: { hash: string; data: string[] } }

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

export function originType(originalLanguage: string): string {
  if (originalLanguage === 'ko') return 'Manhwa'
  if (originalLanguage === 'zh' || originalLanguage === 'zh-hk') return 'Manhua'
  return 'Manga'
}

export function pickTitle(title: Record<string, string>, alts: Record<string, string>[]): string {
  return title['id'] ?? title['en'] ?? Object.values(title)[0] ?? ''
}

export function deduplicateChapters(chapters: MDexChapter[]): MDexChapter[] {
  const best = new Map<string, MDexChapter>()
  for (const ch of chapters) {
    const num = ch.attributes.chapter ?? '__null__'
    const prev = best.get(num)
    if (!prev || ch.attributes.pages > prev.attributes.pages) best.set(num, ch)
  }
  return [...best.values()]
}

// ─── Private helpers ─────────────────────────────────────────────────────────

function buildUrl(path: string, params: Record<string, string | string[]>): string {
  const url = new URL(`${MDEX}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v)
    } else {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

async function mdexFetch<T>(url: string, revalidate = 3600): Promise<T> {
  const res = await fetch(url, { next: { revalidate } })
  if (!res.ok) throw new Error(`MangaDex ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

function coverUrl(mangaId: string, rel: MDexRelationship[]): string {
  const cover = rel.find(r => r.type === 'cover_art')
  if (!cover?.attributes?.fileName) return ''
  return `https://uploads.mangadex.org/covers/${mangaId}/${cover.attributes.fileName}.512.jpg`
}

function pickAltTitle(alts: Record<string, string>[]): string {
  const idAlt  = alts.find(a => 'id' in a)
  const jaRo   = alts.find(a => 'ja-ro' in a)
  return idAlt?.id ?? jaRo?.['ja-ro'] ?? ''
}

function pickDescription(desc: Record<string, string>): string {
  return desc['id'] ?? desc['en'] ?? ''
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function parseMangaCard(data: MDexManga): MangaCard {
  const name = pickTitle(data.attributes.title, data.attributes.altTitles)
  return {
    id: data.id,
    slug: slugRegistry.register(data.id, name),
    name,
    type: originType(data.attributes.originalLanguage),
    image: coverUrl(data.id, data.relationships),
    latestChapter: data.attributes.lastChapter
      ? parseFloat(data.attributes.lastChapter) || null
      : null,
    updatedAt: data.attributes.updatedAt,
  }
}

function parseMangaDetail(data: MDexManga, chapters: MDexChapter[]): MangaDetail {
  const card = parseMangaCard(data)
  const { attributes: a, relationships: rel } = data

  const genre       = a.tags.filter(t => t.attributes.group === 'genre').map(t => t.attributes.name.en ?? '').filter(Boolean)
  const demographic = a.tags.filter(t => t.attributes.group === 'demographic').map(t => t.attributes.name.en ?? '').filter(Boolean)
  const themes      = a.tags.filter(t => t.attributes.group === 'theme').map(t => t.attributes.name.en ?? '').filter(Boolean)

  const chapterMetas: ChapterMeta[] = deduplicateChapters(chapters)
    .filter(ch => ch.attributes.chapter !== null)
    .sort((x, y) => parseFloat(x.attributes.chapter!) - parseFloat(y.attributes.chapter!))
    .map(ch => ({
      number:    parseFloat(ch.attributes.chapter!),
      updatedAt: ch.attributes.updatedAt,
      note:      ch.attributes.title ?? '',
    }))
    .reverse() // newest first

  const author = rel.find(r => r.type === 'author')?.attributes?.name ?? ''
  const artist = rel.find(r => r.type === 'artist')?.attributes?.name ?? ''

  return {
    ...card,
    name2:         pickAltTitle(a.altTitles),
    description:   pickDescription(a.description),
    genre,
    demographic,
    themes,
    author,
    artist,
    rate:          a.rating?.bayesian ?? a.rating?.average ?? 0,
    status:        capitalizeFirst(a.status),
    rilis:         a.year?.toString() ?? '',
    chapters:      chapterMetas,
    contentRating: a.contentRating,
  }
}

function typeToLanguage(type: string): string {
  const map: Record<string, string> = { Manhwa: 'ko', Manhua: 'zh', Manga: 'ja' }
  return map[type] ?? 'ja'
}

// Tag name (lowercase) → MangaDex tag UUID cache
let tagMapCache: Map<string, string> | null = null

async function getTagMap(): Promise<Map<string, string>> {
  if (tagMapCache) return tagMapCache
  const { data } = await mdexFetch<{ data: MDexTag[] }>(`${MDEX}/manga/tag`, 86400 * 7)
  tagMapCache = new Map(
    data
      .filter(t => t.attributes.group === 'genre' || t.attributes.group === 'theme')
      .map(t => [(t.attributes.name.en ?? '').toLowerCase(), t.id])
  )
  return tagMapCache
}

async function resolveSlug(slug: string): Promise<string> {
  const cached = slugRegistry.getUuid(slug)
  if (cached) return cached

  // Detect collision suffix: trailing `-xxxxxxxx` (8 hex chars)
  const collisionMatch = slug.match(/^(.+)-([0-9a-f]{8})$/)
  const searchSlug = collisionMatch ? collisionMatch[1] : slug
  const uuidPrefix = collisionMatch ? collisionMatch[2] : null

  const query = searchSlug.replace(/-/g, ' ')
  const url = buildUrl('/manga', {
    title: query,
    limit: '5',
    'availableTranslatedLanguage[]': 'id',
    'contentRating[]': CONTENT_RATINGS,
    'includes[]': ['cover_art', 'author', 'artist'],
  })
  const { data } = await mdexFetch<MDexListResponse>(url, 3600)
  if (!data.length) throw new Error(`Manga not found: ${slug}`)

  for (const manga of data) {
    const name = pickTitle(manga.attributes.title, manga.attributes.altTitles)
    slugRegistry.register(manga.id, name)
  }

  // If we stripped a collision suffix, also try to match by UUID prefix
  if (uuidPrefix) {
    const byPrefix = data.find(m => m.id.replace(/-/g, '').startsWith(uuidPrefix))
    if (byPrefix) {
      const name = pickTitle(byPrefix.attributes.title, byPrefix.attributes.altTitles)
      slugRegistry.register(byPrefix.id, name)
      return byPrefix.id
    }
  }

  return slugRegistry.getUuid(slug) ?? data[0].id
}

async function fetchChapterFeed(uuid: string, lang = 'id'): Promise<MDexChapter[]> {
  const url = buildUrl(`/manga/${uuid}/feed`, {
    'translatedLanguage[]': lang,
    'order[chapter]': 'asc',
    limit: '500',
    'contentRating[]': CONTENT_RATINGS,
  })
  const { data } = await mdexFetch<MDexFeedResponse>(url, 3600)
  return data
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class MangadexProvider implements MangaProvider {
  private async fetchList(
    params: Record<string, string | string[]>,
    revalidate = 3600,
  ): Promise<MDexListResponse> {
    const base: Record<string, string | string[]> = {
      'contentRating[]': CONTENT_RATINGS,
      'includes[]':      ['cover_art', 'author', 'artist'],
      'availableTranslatedLanguage[]': 'id',
    }
    return mdexFetch<MDexListResponse>(buildUrl('/manga', { ...base, ...params }), revalidate)
  }

  async getPopular(): Promise<MangaCard[]> {
    const { data } = await this.fetchList({ limit: '12', 'order[followedCount]': 'desc' })
    return data.map(parseMangaCard)
  }

  async getLatestUpdate(): Promise<MangaCard[]> {
    const { data } = await this.fetchList({ limit: '12', 'order[latestUploadedChapter]': 'desc' })
    return data.map(parseMangaCard)
  }

  async getNewArrivals(): Promise<MangaCard[]> {
    const { data } = await this.fetchList({ limit: '12', 'order[createdAt]': 'desc' })
    return data.map(parseMangaCard)
  }

  async getPopularByType(type: string): Promise<MangaCard[]> {
    const { data } = await this.fetchList({
      limit: '10',
      'originalLanguage[]': [typeToLanguage(type)],
      'order[followedCount]': 'desc',
    })
    return data.map(parseMangaCard).slice(0, 8)
  }

  async getTopRatedByType(type: string): Promise<MangaCard[]> {
    const { data } = await this.fetchList({
      limit: '10',
      'originalLanguage[]': [typeToLanguage(type)],
      'order[rating]': 'desc',
    })
    return data.map(parseMangaCard)
  }

  async getList(opts: {
    genre?: string
    sort?:  'update' | 'create' | 'rating'
    type?:  string
    after?: string
  }): Promise<PaginatedResult<MangaCard>> {
    const limit  = 32
    const offset = parseInt(opts.after ?? '0', 10) || 0
    const params: Record<string, string | string[]> = {
      limit:  String(limit),
      offset: String(offset),
    }

    if (opts.type) params['originalLanguage[]'] = [typeToLanguage(opts.type)]

    if (opts.genre) {
      const tagMap = await getTagMap()
      const tagId  = tagMap.get(opts.genre.toLowerCase())
      if (tagId) params['includedTags[]'] = [tagId]
    }

    if (opts.sort === 'rating')       params['order[rating]']                = 'desc'
    else if (opts.sort === 'create')  params['order[createdAt]']             = 'desc'
    else                              params['order[latestUploadedChapter]'] = 'desc'

    const { data, total } = await this.fetchList(params)
    const nextOffset = offset + limit

    return {
      data:       data.map(parseMangaCard),
      nextCursor: nextOffset < total ? String(nextOffset) : null,
      hasMore:    nextOffset < total,
    }
  }

  async getManga(slug: string): Promise<MangaDetail> {
    const uuid = await resolveSlug(slug)
    const url  = buildUrl(`/manga/${uuid}`, { 'includes[]': ['cover_art', 'author', 'artist'] })
    const { data } = await mdexFetch<{ data: MDexManga }>(url, 3600)

    let chapters = await fetchChapterFeed(uuid, 'id')
    if (chapters.length === 0) chapters = await fetchChapterFeed(uuid, 'en')

    return parseMangaDetail(data, chapters)
  }

  async getChapter(slug: string, chapter: number): Promise<ChapterDetail> {
    const uuid = await resolveSlug(slug)

    let chapters = await fetchChapterFeed(uuid, 'id')
    if (chapters.length === 0) chapters = await fetchChapterFeed(uuid, 'en')

    const deduped = deduplicateChapters(chapters)
    const match   = deduped.find(
      ch => ch.attributes.chapter !== null &&
            (ch.attributes.chapter === String(chapter) ||
             parseFloat(ch.attributes.chapter) === chapter)
    )
    if (!match) throw new Error(`Chapter ${chapter} not found in ${slug}`)

    const atHome = await mdexFetch<MDexAtHome>(`${MDEX}/at-home/server/${match.id}`, 300)
    const { baseUrl, chapter: { hash, data: pages } } = atHome
    const imageUrls = pages.map(f =>
      `/api/proxy-image?url=${encodeURIComponent(`${baseUrl}/data/${hash}/${f}`)}`
    )

    // Manga name + image (reuse cached fetch)
    const mangaUrl = buildUrl(`/manga/${uuid}`, { 'includes[]': 'cover_art' })
    const { data: mangaData } = await mdexFetch<{ data: MDexManga }>(mangaUrl, 3600)
    const mangaName  = pickTitle(mangaData.attributes.title, mangaData.attributes.altTitles)
    const mangaImage = coverUrl(uuid, mangaData.relationships)

    // Prev / next chapter numbers
    const sorted = [...new Set(
      deduped
        .map(ch => parseFloat(ch.attributes.chapter ?? ''))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b)
    )]
    const idx  = sorted.indexOf(chapter)
    const prev = idx > 0                  ? sorted[idx - 1] : null
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null

    return { mangaSlug: slug, mangaName, mangaImage, chapter, pages: imageUrls, prev, next }
  }

  async search(query: string, opts?: { type?: string }): Promise<MangaCard[]> {
    if (!query.trim()) return []
    const params: Record<string, string | string[]> = { title: query.trim(), limit: '20' }
    if (opts?.type) params['originalLanguage[]'] = [typeToLanguage(opts.type)]
    const { data } = await this.fetchList(params, 60)
    return data.map(parseMangaCard)
  }

  async getRelated(genre: string, excludeSlug: string): Promise<MangaCard[]> {
    const tagMap = await getTagMap()
    const tagId  = tagMap.get(genre.toLowerCase())
    if (!tagId) return []
    const { data } = await this.fetchList({
      'includedTags[]': [tagId],
      limit: '15',
      'order[followedCount]': 'desc',
    })
    return data.map(parseMangaCard).filter(m => m.slug !== excludeSlug).slice(0, 8)
  }

  getGenres(): string[] {
    return [
      'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
      'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
      'Supernatural', 'Thriller', 'Isekai', 'Mecha', 'Historical',
    ]
  }
}
