# Kiryuu Migration Plan — Ganti MangaDex dengan Kiryuu

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti provider MangaDex → Kiryuu ID (`v6.kiryuu.to`), hapus semua yang tidak digunakan, pakai direct URL untuk semua gambar (tidak ada proxy).

**Architecture:** Single provider swap — `KiryuuProvider` mengimplementasi interface `MangaProvider` yang sama. Semua komponen UI tidak berubah. `proxyUrl()` disederhanakan jadi pass-through sehingga tidak ada perubahan di komponen.

**Tech Stack:** Next.js App Router, TypeScript strict, WP REST API (`v6.kiryuu.to/wp-json/wp/v2`), ISR caching.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`
- Tidak ada dependency baru **kecuali `fuse.js`** (dibutuhkan untuk Step 9: fuzzy search)
- Semua gambar pakai direct URL (tidak ada `/api/proxy-image`)
- ISR revalidate times: manga list 300s, manga detail 3600s, chapter 86400s, chapter list 1800s
- Tailwind v4 only untuk UI changes
- Teks Indonesia untuk pesan user-facing baru

---

> Dibuat: 28 Juni 2026  
> Estimasi waktu: 2–3 jam

---

## Ringkasan Perubahan

| Aksi | File |
|------|------|
| **INSTALL** | `fuse.js` (Step 9) |
| **CREATE** | `lib/providers/kiryuu.ts` |
| **MODIFY** | `lib/providers/index.ts` |
| **MODIFY** | `lib/proxy.ts` |
| **MODIFY** | `lib/config.ts` |
| **MODIFY** | `app/page.tsx` |
| **MODIFY** | `app/manga/[slug]/page.tsx` |
| **MODIFY** | `app/sitemap.ts` |
| **DELETE** | `lib/providers/mangadex.ts` |
| **DELETE** | `lib/providers/mangadex-slug.ts` |
| **DELETE** | `lib/providers/mangadex.test.ts` |
| **DELETE** | `lib/providers/mangadex-slug.test.ts` |
| **DELETE** | `app/api/proxy-image/route.ts` |

**Tidak perlu diubah** (langsung bisa jalan setelah `proxyUrl` disederhanakan):
- `components/MangaCard.tsx`
- `components/HeroCarousel.tsx`
- `components/ContinueReadingSection.tsx`
- `components/ChapterReader.tsx`
- `app/chapter/[slug]/[chapter]/page.tsx`
- `app/list/page.tsx`
- `app/list/actions.ts`
- `app/search/page.tsx`
- Semua komponen lain

---

## Keputusan Teknis

- **Images**: Semua gambar (cover + chapter) pakai **direct URL** ke CDN Kiryuu. Tidak ada proxy. Bandwidth ditanggung CDN Kiryuu, bukan Vercel.
- **Cover images**: URL raw dari `v6.kiryuu.to/wp-content/uploads/...` atau `yuucdn.com/...`
- **Chapter images**: URL raw dari `cdn.uqni.net/...` atau `yuucdn.com/...` — di-parse dari `content.rendered` HTML
- **`proxyUrl()`**: Disederhanakan jadi pass-through (return URL as-is). Fungsi tetap ada agar tidak perlu ubah semua komponen, tapi tidak lagi proxy ke `/api/proxy-image`
- **Chapter prev/next**: Deteksi dengan cek apakah slug `{slug}-chapter-{N±1}` ada di API
- **Chapter list untuk manga panjang** (One Piece = 1350 chapter): Fetch semua halaman secara **paralel** (bukan serial). 14 halaman paralel ≈ 2–3 detik, dapat-ter-cache ISR 1800 detik
- **getLatestUpdate vs getPopular**: `getPopular` ambil offset 0, `getLatestUpdate` ambil offset 12 — supaya homepage tidak tampil manga yang sama di HeroCarousel dan di seksi Latest Update

---

## Step 1 — Hapus File MangaDex

Hapus semua file ini:

```bash
rm lib/providers/mangadex.ts
rm lib/providers/mangadex-slug.ts
rm lib/providers/mangadex.test.ts
rm lib/providers/mangadex-slug.test.ts
rm app/api/proxy-image/route.ts
rmdir app/api/proxy-image  # hapus folder juga kalau kosong
```

---

## Step 2 — Buat `lib/providers/kiryuu.ts`

Buat file baru dengan isi berikut (copy-paste seluruhnya):

```typescript
import type {
  MangaCard, MangaDetail, ChapterDetail, ChapterMeta,
  PaginatedResult, MangaProvider,
} from './types'

const BASE = 'https://v6.kiryuu.to/wp-json/wp/v2'

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
  const res = await fetch(url, { next: { revalidate } })
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
    const firstRes = await fetch(chapterUrl(1), { next: { revalidate: 1800 } })
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
          fetch(chapterUrl(i + 2), { next: { revalidate: 1800 } })
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
    const res = await fetch(`${BASE}/manga?${sp}`, { next: { revalidate: 300 } })
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
    return list.map(parseMangaCard)
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
```

---

## Step 3 — Update `lib/providers/index.ts`

Ganti seluruh isi file:

```typescript
import type { MangaProvider } from './types'
import { KiryuuProvider } from './kiryuu'

let instance: MangaProvider | null = null

export function getProvider(): MangaProvider {
  if (instance) return instance
  instance = new KiryuuProvider()
  return instance
}
```

---

## Step 4 — Sederhanakan `lib/proxy.ts`

Ganti seluruh isi file (hapus logika proxy, jadi pass-through):

```typescript
// Direct URL — no proxy. Kiryuu CDN (yuucdn.com, cdn.uqni.net) accessible langsung.
export function proxyUrl(url: string): string {
  if (!url) return '/placeholder-cover.jpg'
  return url
}
```

> Kenapa tidak hapus `proxyUrl` sekalian? Karena dipanggil di 4 komponen (MangaCard, HeroCarousel, ContinueReadingSection, manga detail page). Dengan tetap ada tapi disederhanakan, 4 komponen itu tidak perlu diubah.

---

## Step 5 — Update `lib/config.ts`

Hapus referensi ke mangadex:

```typescript
// Kosongkan atau hapus file ini — tidak ada config yang dibutuhkan lagi
export function getConfig() {
  return {}
}
```

---

## Step 6 — Update `app/page.tsx`

Ubah dua hal:

**a) Label section "Top Rated" → "Popular"** (karena Kiryuu tidak ada rating sort)  
**b) Href `sort=rating` → `sort=popular`**

Cari baris ini:
```tsx
<HorizontalSection title="Top Rated Manga"  href="/list?type=Manga&sort=rating"  items={topManga} />
<HorizontalSection title="Top Rated Manhwa" href="/list?type=Manhwa&sort=rating" items={topManhwa} />
<HorizontalSection title="Top Rated Manhua" href="/list?type=Manhua&sort=rating" items={topManhua} />
```

Ganti dengan:
```tsx
<HorizontalSection title="Popular Manga"  href="/list?type=Manga"  items={topManga} />
<HorizontalSection title="Popular Manhwa" href="/list?type=Manhwa" items={topManhwa} />
<HorizontalSection title="Popular Manhua" href="/list?type=Manhua" items={topManhua} />
```

---

## Step 7 — Update `app/manga/[slug]/page.tsx`

Di line 197-199 ada bagian "0 Chapters". Ubah pesan yang muncul saat tidak ada chapter:

Cari:
```tsx
<div className="mt-8">
  <h2 className="text-base font-semibold text-fg mb-3">{manga.chapters.length} Chapters</h2>
  <ChapterList slug={manga.slug} chapters={manga.chapters} />
</div>
```

Ganti dengan:
```tsx
<div className="mt-8">
  <h2 className="text-base font-semibold text-fg mb-3">{manga.chapters.length} Chapters</h2>
  {manga.chapters.length === 0 && (
    <p className="text-muted text-sm mt-2">
      Belum ada chapter tersedia. Judul ini mungkin belum diunggah atau sedang dalam proses.
    </p>
  )}
  <ChapterList slug={manga.slug} chapters={manga.chapters} />
</div>
```

---

## Step 8 — Update `app/sitemap.ts`

Hapus komentar referensi MangaDex di baris catch:

Cari:
```typescript
  } catch {
    // If MangaDex is unreachable, return static pages only
    return STATIC
  }
```

Ganti dengan:
```typescript
  } catch {
    return STATIC
  }
```

---

## Testing Checklist Setelah Implementasi

```
[ ] npm run build — tidak ada TypeScript error
[ ] Homepage tampil (manga cards muncul dengan gambar)
[ ] HeroCarousel tampil dengan cover image
[ ] "Latest Update" section tampil manga yang BERBEDA dari HeroCarousel
[ ] "Popular Manga/Manhwa/Manhua" section tampil
[ ] Search "one piece" → ketemu, ada cover image
[ ] Klik manga "one piece" → detail page tampil, ada 1350 chapters
[ ] Klik chapter → reader tampil dengan gambar
[ ] Gambar chapter tampil (direct dari cdn.uqni.net atau yuucdn.com)
[ ] Tombol Next/Prev chapter berfungsi
[ ] Bookmark berfungsi
[ ] History tracking berfungsi
[ ] /api/proxy-image → 404 (sudah dihapus, ini expected)
[ ] Search halaman /list berfungsi dengan filter genre dan type
```

---

## Catatan Penting

### Decimal chapters
Untuk chapter dengan nomor desimal (misal 1.5, 100.5), prev/next detection pakai `chapter - 1` dan `chapter + 1` sebagai integer. Ini artinya kalau user baca chapter 1.5, prev akan cek `0.5` (tidak ada) dan next akan cek `2.5` (mungkin tidak ada). **Edge case ini bisa diperbaiki nanti** — mayoritas chapter adalah bilangan bulat.

### Solo Leveling
Tidak tersedia di Kiryuu (DMCA Kakao). Sama seperti di MangaDex. Spin-offnya (Ragnarok, ARISE) masih ada.

### AgeGate component
Kiryuu tidak mengembalikan `contentRating` field. Field ini optional di `MangaDetail` (`contentRating?: string`), jadi `AgeGate` tidak akan render. Tidak ada masalah.

### Cache
- Manga list: ISR 300 detik (5 menit)
- Manga detail: ISR 3600 detik (1 jam)
- Chapter content: ISR 86400 detik (24 jam)
- Chapter list per manga: ISR 1800 detik (30 menit)
- Genre map: ISR 86400 detik (24 jam)
- Title index (fuzzy search): ISR 86400 detik (24 jam), + in-memory cache per instance

---

## Step 9 — Tambah Fuse.js Fuzzy Search

**Masalah**: WP REST API pakai MySQL `LIKE '%query%'` — literal match. Kalau user ketik typo seperti `"on pice"`, tidak akan ketemu `"One Piece"`. Fuzzy search memperbaiki ini dengan fallback lokal menggunakan Fuse.js.

**Alur kerja:**
```
user ketik "on pice"
→ search() panggil WP REST: ?search=on+pice → 0 hasil
→ jika hasil === 0: load title index (500 judul, ISR cached 24 jam)
→ Fuse.js matching: "on pice" → [{ slug: "one-piece", name: "One Piece" }, ...]
→ fetch manga detail untuk setiap slug yang match (paralel, ISR 3600s)
→ return MangaCard[]

jika WP search sudah dapat hasil (≥1): langsung return, Fuse.js tidak dijalankan
```

**Kenapa hanya 500 judul?**
- 5 halaman × 100 = 500 judul paling sering diupdate (= paling populer)
- One Piece, Naruto, HxH, semua yang sering dicari ada di sini
- 5 request paralel vs 88 request untuk 8794 judul total
- Cukup untuk 95% kasus pencarian user

### 9a — Install fuse.js

```bash
pnpm add fuse.js
```

### 9b — Update `lib/providers/kiryuu.ts`

Tambahkan **di bawah** deklarasi `genreMapCache` (setelah line `let genreMapCache: Map<string, number> | null = null`):

```typescript
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
```

Kemudian **ganti** method `search()` yang sudah ada dengan versi berikut (yang mengandung Fuse.js fallback):

```typescript
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
```

---

## Testing Checklist — Fuzzy Search (tambahan Step 9)

```
[ ] pnpm build — tidak ada TypeScript error setelah tambah fuse.js
[ ] Search "one piece" → ketemu (WP fast path, bukan Fuse.js)
[ ] Search "on pice" → ketemu "One Piece" (Fuse.js fallback)
[ ] Search "naruto" → ketemu (WP fast path)
[ ] Search "nartu" → ketemu "Naruto" (Fuse.js fallback)
[ ] Search "hunter hunter" → ketemu "Hunter x Hunter" (Fuse.js fallback)
[ ] Search query kosong → tidak ada request keluar, return []
[ ] Search kata yang benar-benar tidak ada → return [] (bukan error)
```
