# MangaDex Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Keikomik/Firestore with MangaDex as the sole content provider, with SEO-first Indonesian metadata, human-readable slug URLs, image proxy for reliable offline saves, per-manga age gate, and a dynamic sitemap with all manga pages.

**Architecture:** `MangadexProvider` implements the existing `MangaProvider` interface — all 11 methods — so zero changes needed in pages or components. A `SlugRegistry` singleton maps human-readable slugs (generated from titles) to MangaDex UUIDs server-side. Chapter images are served through `/api/proxy-image` so the service worker can cache stable URLs for offline reading.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest + @testing-library/react, MangaDex REST API (no API key required), Tailwind v4 design tokens.

## Global Constraints

- Never use `any` type — use `unknown` and narrow explicitly
- All client components must have `'use client'` at top
- All fetch to `api.mangadex.org` must happen server-side only (never from browser)
- MangaDex content ratings to include: `safe`, `suggestive`, `mature`, `erotica`, `pornographic`
- Language priority for titles/descriptions: Indonesian (`id`) → English (`en`) → first available
- Image proxy domain whitelist (strict): `uploads.mangadex.org` and `*.mangadex.network`
- No new npm packages — use only what is already installed
- Test runner: `pnpm test` (Vitest, jsdom, `@testing-library/jest-dom`, `@` alias = project root)
- TypeScript check: `pnpm tsc --noEmit` (must be 0 errors before every commit)
- Branch: `feat/mangadex-integration`

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `lib/providers/mangadex-slug.ts` | `slugify()` + `SlugRegistry` singleton — slug↔UUID mapping |
| `lib/providers/mangadex-slug.test.ts` | Tests for slugify and SlugRegistry |
| `lib/providers/mangadex.ts` | `MangadexProvider` — all 11 MangaProvider methods |
| `lib/providers/mangadex.test.ts` | Tests for parsing helpers in MangadexProvider |
| `app/api/proxy-image/route.ts` | Image proxy — fetch MangaDex CDN images, forward to browser |
| `components/AgeGate.tsx` | Per-manga 18+ confirmation overlay |
| `public/robots.txt` | Allow all crawlers, disallow `/api/` |

### Modified Files
| File | What changes |
|---|---|
| `lib/providers/types.ts` | Add `contentRating?: string` to `MangaDetail` |
| `lib/providers/index.ts` | Simplify to always return `MangadexProvider` |
| `lib/config.ts` | Remove KEIKOMIK env var checks, just return `MANGA_PROVIDER` |
| `app/manga/[slug]/page.tsx` | Indonesian SEO metadata, JSON-LD, AgeGate wiring |
| `app/chapter/[slug]/[chapter]/page.tsx` | Indonesian SEO metadata |
| `app/sitemap.ts` | Async dynamic sitemap fetching manga from MangaDex |
| `.env.local` | `MANGA_PROVIDER=mangadex` (remove KEIKOMIK vars) |

### Deleted Files
| File | Why |
|---|---|
| `lib/firestore.ts` | Firestore not used anymore |
| `lib/providers/keikomik.ts` | Replaced by MangadexProvider |
| `lib/providers/keikomik.test.ts` | Provider deleted |

---

## Task 1: SlugRegistry (TDD)

**Files:**
- Create: `lib/providers/mangadex-slug.ts`
- Create: `lib/providers/mangadex-slug.test.ts`

**Produces:** `slugify(title: string): string`, `SlugRegistry` class (exported for tests), `slugRegistry` singleton (used by Task 2)

- [ ] **Step 1: Write failing tests**

Create `lib/providers/mangadex-slug.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { slugify, SlugRegistry } from './mangadex-slug'

describe('slugify', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(slugify('One Piece')).toBe('one-piece')
  })

  it('removes special characters', () => {
    expect(slugify('Mairimashita! Iruma-kun')).toBe('mairimashita-iruma-kun')
  })

  it('collapses multiple dashes', () => {
    expect(slugify('86--Eighty Six')).toBe('86-eighty-six')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('!Hello!')).toBe('hello')
  })

  it('handles already-clean input', () => {
    expect(slugify('naruto')).toBe('naruto')
  })

  it('handles non-latin characters by removing them', () => {
    expect(slugify('進撃の巨人 Attack on Titan')).toBe('attack-on-titan')
  })
})

describe('SlugRegistry', () => {
  let reg: SlugRegistry

  beforeEach(() => { reg = new SlugRegistry() })

  it('registers a UUID and returns a slug', () => {
    expect(reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')).toBe('one-piece')
  })

  it('getUuid returns the UUID for a known slug', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(reg.getUuid('one-piece')).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('getSlug returns the slug for a known UUID', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(reg.getSlug('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe('one-piece')
  })

  it('returns same slug when same UUID is registered twice', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')).toBe('one-piece')
  })

  it('makes slug unique when two different UUIDs produce the same base slug', () => {
    reg.register('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    const slug2 = reg.register('11111111-bbbb-cccc-dddd-eeeeeeeeeeee', 'One Piece')
    expect(slug2).toBe('one-piece-11111111')
    expect(reg.getUuid('one-piece-11111111')).toBe('11111111-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('returns undefined for unknown slug', () => {
    expect(reg.getUuid('unknown')).toBeUndefined()
  })

  it('returns undefined for unknown UUID', () => {
    expect(reg.getSlug('unknown-uuid')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
pnpm test lib/providers/mangadex-slug.test.ts
```

Expected: FAIL — `Cannot find module './mangadex-slug'`

- [ ] **Step 3: Implement `lib/providers/mangadex-slug.ts`**

```ts
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export class SlugRegistry {
  private slugToUuid = new Map<string, string>()
  private uuidToSlug = new Map<string, string>()

  register(uuid: string, title: string): string {
    const existing = this.uuidToSlug.get(uuid)
    if (existing) return existing
    const slug = this.makeUnique(slugify(title), uuid)
    this.slugToUuid.set(slug, uuid)
    this.uuidToSlug.set(uuid, slug)
    return slug
  }

  getUuid(slug: string): string | undefined {
    return this.slugToUuid.get(slug)
  }

  getSlug(uuid: string): string | undefined {
    return this.uuidToSlug.get(uuid)
  }

  private makeUnique(base: string, uuid: string): string {
    if (!this.slugToUuid.has(base)) return base
    return `${base}-${uuid.slice(0, 8)}`
  }
}

export const slugRegistry = new SlugRegistry()
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
pnpm test lib/providers/mangadex-slug.test.ts
```

Expected: 12 tests, all PASS

- [ ] **Step 5: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/providers/mangadex-slug.ts lib/providers/mangadex-slug.test.ts
git commit -m "feat: SlugRegistry — human-readable slug to MangaDex UUID mapping"
```

---

## Task 2: MangadexProvider

**Files:**
- Create: `lib/providers/mangadex.ts`
- Create: `lib/providers/mangadex.test.ts`
- Modify: `lib/providers/types.ts` — add `contentRating?: string` to `MangaDetail`

**Consumes:** `slugRegistry` from `lib/providers/mangadex-slug.ts`, `MangaProvider` interface from `lib/providers/types.ts`

**Produces:** `MangadexProvider` class (used by Task 3 to wire provider)

- [ ] **Step 1: Add `contentRating` to MangaDetail type**

In `lib/providers/types.ts`, add one field to `MangaDetail`:

```ts
export type MangaDetail = MangaCard & {
  name2: string
  description: string
  genre: string[]
  demographic: string[]
  themes: string[]
  author: string
  artist: string
  rate: number
  status: string
  rilis: string
  chapters: ChapterMeta[]
  contentRating?: string   // ← ADD THIS LINE
}
```

- [ ] **Step 2: Write failing tests for pure parsing functions**

Create `lib/providers/mangadex.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slugify } from './mangadex-slug'

// Test the pure helper functions that will be exported from mangadex.ts
// We import them after implementation — for now this file just defines what we expect

describe('slugify (sanity check from mangadex-slug)', () => {
  it('works', () => expect(slugify('Test Manga')).toBe('test-manga'))
})

// These tests use the internal helpers once exported:
describe('originType', () => {
  it('maps ko to Manhwa', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('ko')).toBe('Manhwa')
  })
  it('maps zh to Manhua', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('zh')).toBe('Manhua')
  })
  it('maps zh-hk to Manhua', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('zh-hk')).toBe('Manhua')
  })
  it('maps ja to Manga', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('ja')).toBe('Manga')
  })
  it('defaults unknown to Manga', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('fr')).toBe('Manga')
  })
})

describe('deduplicateChapters', () => {
  it('keeps the chapter with more pages when two groups translate same number', async () => {
    const { deduplicateChapters } = await import('./mangadex')
    const input = [
      { id: 'ch-a', attributes: { chapter: '1', translatedLanguage: 'id', pages: 20, updatedAt: '', title: null } },
      { id: 'ch-b', attributes: { chapter: '1', translatedLanguage: 'id', pages: 25, updatedAt: '', title: null } },
    ]
    const result = deduplicateChapters(input)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ch-b')
  })

  it('keeps unique chapters when no conflict', async () => {
    const { deduplicateChapters } = await import('./mangadex')
    const input = [
      { id: 'ch-1', attributes: { chapter: '1', translatedLanguage: 'id', pages: 20, updatedAt: '', title: null } },
      { id: 'ch-2', attributes: { chapter: '2', translatedLanguage: 'id', pages: 18, updatedAt: '', title: null } },
    ]
    expect(deduplicateChapters(input)).toHaveLength(2)
  })
})

describe('pickTitle', () => {
  it('prefers Indonesian title', async () => {
    const { pickTitle } = await import('./mangadex')
    expect(pickTitle({ id: 'Indo Title', en: 'English Title' }, [])).toBe('Indo Title')
  })
  it('falls back to English', async () => {
    const { pickTitle } = await import('./mangadex')
    expect(pickTitle({ en: 'English Title' }, [])).toBe('English Title')
  })
  it('falls back to any available title', async () => {
    const { pickTitle } = await import('./mangadex')
    expect(pickTitle({ ja: 'Japanese Title' }, [])).toBe('Japanese Title')
  })
})
```

- [ ] **Step 3: Run tests — confirm originType/deduplicateChapters fail**

```bash
pnpm test lib/providers/mangadex.test.ts
```

Expected: FAIL on dynamic import — `Cannot find module './mangadex'`

- [ ] **Step 4: Implement `lib/providers/mangadex.ts`**

```ts
import type {
  MangaCard, MangaDetail, ChapterDetail, ChapterMeta,
  PaginatedResult, MangaProvider,
} from './types'
import { slugRegistry } from './mangadex-slug'

const MDEX = 'https://api.mangadex.org'
const CONTENT_RATINGS = ['safe', 'suggestive', 'mature', 'erotica', 'pornographic']

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

  const genre      = a.tags.filter(t => t.attributes.group === 'genre').map(t => t.attributes.name.en ?? '').filter(Boolean)
  const demographic = a.tags.filter(t => t.attributes.group === 'demographic').map(t => t.attributes.name.en ?? '').filter(Boolean)
  const themes     = a.tags.filter(t => t.attributes.group === 'theme').map(t => t.attributes.name.en ?? '').filter(Boolean)

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
      .filter(t => t.attributes.group === 'genre')
      .map(t => [(t.attributes.name.en ?? '').toLowerCase(), t.id])
  )
  return tagMapCache
}

async function resolveSlug(slug: string): Promise<string> {
  const cached = slugRegistry.getUuid(slug)
  if (cached) return cached

  // Slug miss: search MangaDex by title derived from slug
  const query = slug.replace(/-/g, ' ')
  const url = buildUrl('/manga', {
    title: query,
    limit: '5',
    'availableTranslatedLanguage[]': 'id',
    'contentRating[]': CONTENT_RATINGS,
    'includes[]': ['cover_art', 'author', 'artist'],
  })
  const { data } = await mdexFetch<MDexListResponse>(url, 3600)
  if (!data.length) throw new Error(`Manga not found: ${slug}`)

  // Register all results so future lookups are cached
  for (const manga of data) {
    const name = pickTitle(manga.attributes.title, manga.attributes.altTitles)
    slugRegistry.register(manga.id, name)
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

    if (opts.sort === 'rating')       params['order[rating]']                 = 'desc'
    else if (opts.sort === 'create')  params['order[createdAt]']              = 'desc'
    else                              params['order[latestUploadedChapter]']  = 'desc'

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
```

- [ ] **Step 5: Run tests — confirm they PASS**

```bash
pnpm test lib/providers/mangadex.test.ts
```

Expected: All tests PASS (originType, deduplicateChapters, pickTitle)

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add lib/providers/types.ts lib/providers/mangadex.ts lib/providers/mangadex.test.ts
git commit -m "feat: MangadexProvider — full MangaProvider implementation"
```

---

## Task 3: Image Proxy + Wire Provider + Delete Old Files

**Files:**
- Create: `app/api/proxy-image/route.ts`
- Modify: `lib/config.ts`
- Modify: `lib/providers/index.ts`
- Modify: `.env.local`
- Delete: `lib/firestore.ts`, `lib/providers/keikomik.ts`, `lib/providers/keikomik.test.ts`

**Consumes:** `MangadexProvider` from Task 2

- [ ] **Step 1: Create image proxy**

Create `app/api/proxy-image/route.ts`:

```ts
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
```

- [ ] **Step 2: Simplify `lib/config.ts`**

Replace the entire file:

```ts
export function getConfig() {
  const MANGA_PROVIDER = process.env.MANGA_PROVIDER ?? 'mangadex'
  return { MANGA_PROVIDER }
}
```

- [ ] **Step 3: Update `lib/providers/index.ts`**

Replace the entire file:

```ts
import type { MangaProvider } from './types'
import { MangadexProvider } from './mangadex'

let instance: MangaProvider | null = null

export function getProvider(): MangaProvider {
  if (instance) return instance
  instance = new MangadexProvider()
  return instance
}
```

- [ ] **Step 4: Update `.env.local`**

Replace the entire file content with:

```
MANGA_PROVIDER=mangadex
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

(The KEIKOMIK vars are removed — Vercel preview env vars will be cleaned up separately.)

- [ ] **Step 5: Delete old files**

```bash
rm lib/firestore.ts lib/providers/keikomik.ts lib/providers/keikomik.test.ts
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. If there are errors about missing keikomik imports, they shouldn't exist because keikomik was only imported in `lib/providers/index.ts` which was already updated.

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```

Expected: Tests for `keikomik.test.ts` are gone (file deleted), remaining tests pass. Count should be around 20-25 depending on what keikomik tests contained.

- [ ] **Step 8: Commit**

```bash
git add app/api/proxy-image/route.ts lib/config.ts lib/providers/index.ts .env.local
git rm lib/firestore.ts lib/providers/keikomik.ts lib/providers/keikomik.test.ts
git commit -m "feat: image proxy, wire MangadexProvider, remove Keikomik/Firestore"
```

---

## Task 4: AgeGate Component

**Files:**
- Create: `components/AgeGate.tsx`
- Modify: `app/manga/[slug]/page.tsx`

**Consumes:** `manga.contentRating` from `MangaDetail` (added to type in Task 2)

- [ ] **Step 1: Create AgeGate component**

Create `components/AgeGate.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const KEY_PREFIX = 'mikomi_age_'
const EXPLICIT_RATINGS = ['erotica', 'pornographic']

export default function AgeGate({ mangaId, contentRating }: { mangaId: string; contentRating: string }) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (!EXPLICIT_RATINGS.includes(contentRating)) {
      setConfirmed(true)
      setMounted(true)
      return
    }
    const already = localStorage.getItem(`${KEY_PREFIX}${mangaId}`) === '1'
    setConfirmed(already)
    setMounted(true)
  }, [mangaId, contentRating])

  if (!mounted || confirmed) return null

  function confirm() {
    localStorage.setItem(`${KEY_PREFIX}${mangaId}`, '1')
    setConfirmed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm mx-4 text-center">
        <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
        <h2 className="text-lg font-bold text-fg mb-2">Konten 18+</h2>
        <p className="text-muted text-sm mb-6">
          Konten ini mengandung materi dewasa. Apakah kamu berusia 18 tahun atau lebih?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg bg-surface-2 text-fg text-sm hover:bg-border transition-colors"
          >
            Kembali
          </button>
          <button
            onClick={confirm}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/80 transition-colors"
          >
            Ya, saya 18+
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire AgeGate into manga detail page**

In `app/manga/[slug]/page.tsx`, add the import at the top:

```ts
import AgeGate from '@/components/AgeGate'
```

Then add the component as the **first child** of the returned JSX fragment (before `<div className="md:flex gap-8">`):

```tsx
return (
  <>
    {manga.contentRating && (
      <AgeGate mangaId={manga.id} contentRating={manga.contentRating} />
    )}
    <div className="md:flex gap-8">
      {/* ... rest of existing JSX unchanged ... */}
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/AgeGate.tsx app/manga/[slug]/page.tsx
git commit -m "feat: per-manga age gate for explicit content"
```

---

## Task 5: SEO — Indonesian Metadata + JSON-LD

**Files:**
- Modify: `app/manga/[slug]/page.tsx`
- Modify: `app/chapter/[slug]/[chapter]/page.tsx`

- [ ] **Step 1: Update manga detail page — generateMetadata**

In `app/manga/[slug]/page.tsx`, replace the `generateMetadata` function:

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const manga = await getProvider().getManga(slug)
    const genreList = manga.genre.slice(0, 3).join(', ')
    const desc = manga.description
      ? `${manga.description.slice(0, 120)} — Baca gratis di Mikomi.`
      : `Baca manga ${manga.name} bahasa Indonesia online gratis di Mikomi. Genre: ${genreList}. Status: ${manga.status}.`
    return {
      title:       `Baca ${manga.name} Bahasa Indonesia | Mikomi`,
      description: desc,
      openGraph: {
        title:       `Baca ${manga.name} Bahasa Indonesia`,
        description: desc,
        images:      manga.image ? [{ url: manga.image, alt: manga.name }] : [],
        type:        'book',
        siteName:    'Mikomi',
      },
      twitter: {
        card:        'summary_large_image',
        title:       `Baca ${manga.name} Bahasa Indonesia`,
        description: desc,
        images:      manga.image ? [manga.image] : [],
      },
    }
  } catch {
    return { title: 'Manga — Mikomi' }
  }
}
```

- [ ] **Step 2: Add JSON-LD to manga detail page**

In `app/manga/[slug]/page.tsx`, add `Script` import at the top:

```ts
import Script from 'next/script'
```

Then inside `MangaDetailPage`, after the AgeGate line and before `<div className="md:flex gap-8">`, add:

```tsx
<Script id="manga-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{
  __html: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Book',
    name:          manga.name,
    inLanguage:    'id',
    genre:         manga.genre,
    author:        manga.author ? { '@type': 'Person', name: manga.author } : undefined,
    numberOfPages: manga.chapters.length,
    url:           `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mikomi.vercel.app'}/manga/${manga.slug}`,
    image:         manga.image || undefined,
    description:   manga.description || undefined,
  })
}} />
```

- [ ] **Step 3: Update chapter page — generateMetadata**

In `app/chapter/[slug]/[chapter]/page.tsx`, replace the `generateMetadata` function:

```ts
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}): Promise<Metadata> {
  const { slug, chapter } = await params
  try {
    const manga = await getProvider().getManga(slug)
    return {
      title:       `Baca ${manga.name} Chapter ${chapter} Sub Indo | Mikomi`,
      description: `Baca ${manga.name} chapter ${chapter} bahasa Indonesia online gratis di Mikomi.`,
      openGraph: {
        title:  `${manga.name} Chapter ${chapter} Sub Indo`,
        images: manga.image ? [{ url: manga.image, alt: manga.name }] : [],
      },
    }
  } catch {
    return { title: `Chapter ${chapter} — Mikomi` }
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add app/manga/[slug]/page.tsx app/chapter/[slug]/[chapter]/page.tsx
git commit -m "feat: Indonesian SEO metadata and JSON-LD for manga and chapter pages"
```

---

## Task 6: Dynamic Sitemap + robots.txt

**Files:**
- Modify: `app/sitemap.ts`
- Create: `public/robots.txt`

- [ ] **Step 1: Create `public/robots.txt`**

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://mikomi.vercel.app/sitemap.xml
```

- [ ] **Step 2: Update `app/sitemap.ts` to async dynamic sitemap**

Replace the entire file:

```ts
import type { MetadataRoute } from 'next'
import { getProvider } from '@/lib/providers'

export const revalidate = 86400

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://mikomi.vercel.app'

const STATIC: MetadataRoute.Sitemap = [
  { url: BASE_URL,                  lastModified: new Date(), changeFrequency: 'daily',  priority: 1   },
  { url: `${BASE_URL}/list`,        lastModified: new Date(), changeFrequency: 'daily',  priority: 0.9 },
  { url: `${BASE_URL}/bookmark`,    lastModified: new Date(), changeFrequency: 'never',  priority: 0.3 },
  { url: `${BASE_URL}/history`,     lastModified: new Date(), changeFrequency: 'never',  priority: 0.3 },
  { url: `${BASE_URL}/offline`,     lastModified: new Date(), changeFrequency: 'never',  priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const provider = getProvider()
    const [{ data: recent }, popular] = await Promise.all([
      provider.getList({ sort: 'update' }),
      provider.getPopular(),
    ])

    // Deduplicate by slug
    const seen = new Set<string>()
    const allManga = [...popular, ...recent].filter(m => !seen.has(m.slug) && seen.add(m.slug))

    const mangaEntries: MetadataRoute.Sitemap = allManga.map(m => ({
      url:             `${BASE_URL}/manga/${m.slug}`,
      lastModified:    m.updatedAt ? new Date(m.updatedAt) : new Date(),
      changeFrequency: 'weekly',
      priority:        0.8,
    }))

    return [...STATIC, ...mangaEntries]
  } catch {
    // If MangaDex is unreachable, return static pages only
    return STATIC
  }
}
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

- [ ] **Step 5: Verify build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: Build succeeds, sitemap route shows as `○ (Static)` with revalidate 86400

- [ ] **Step 6: Commit**

```bash
git add public/robots.txt app/sitemap.ts
git commit -m "feat: dynamic sitemap with manga pages, robots.txt"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| MangaDex as sole provider | Task 3 (wire + delete Keikomik) |
| Human-readable slugs | Task 1 (SlugRegistry) + Task 2 (parseMangaCard) |
| All content ratings | Task 2 (`CONTENT_RATINGS` array, all 5 levels) |
| Age gate per-manga (erotica/pornographic) | Task 4 |
| Firestore deleted | Task 3 |
| Image proxy (stable URLs for SW) | Task 3 |
| MangaDex API server-side only | Task 2 (all fetch inside MangadexProvider, no client import) |
| Indonesian metadata — manga page title | Task 5 |
| Indonesian metadata — chapter page title | Task 5 |
| JSON-LD structured data | Task 5 |
| Dynamic sitemap with manga pages | Task 6 |
| robots.txt | Task 6 |
| Slug resolution with search fallback | Task 2 (`resolveSlug`) |
| Chapter deduplication (multi-group) | Task 2 (`deduplicateChapters`) |
| Indonesian chapters fallback to English | Task 2 (`getChapter`, `getManga`) |
| ISR: manga page 3600, chapter page 86400, sitemap 86400 | Tasks 2, 5, 6 (revalidate values) |

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `slugRegistry.register(uuid, title): string` — defined Task 1, used Task 2 ✓
- `MangaDetail.contentRating?: string` — defined Task 2, consumed Task 4 ✓
- `parseMangaCard(MDexManga): MangaCard` — defined Task 2, used internally ✓
- `deduplicateChapters(MDexChapter[]): MDexChapter[]` — defined Task 2, exported for tests ✓
- Image URLs format `/api/proxy-image?url=...` — produced Task 2 (`getChapter`), proxied Task 3 ✓
- `getProvider()` returns `MangadexProvider` — defined Task 3, used by all pages ✓
