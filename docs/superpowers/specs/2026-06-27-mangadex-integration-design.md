# Mikomi — MangaDex Integration Design

**Date:** 2026-06-27
**Branch:** feat/mangadex-integration
**Goal:** Replace Keikomik/Firestore with MangaDex as sole content provider, with SEO-first URL structure, Indonesian metadata, dynamic sitemap, and image proxy for reliable offline saves.

---

## Decisions

| Keputusan | Pilihan |
|---|---|
| Provider | MangaDex only (ganti total Keikomik) |
| Slug | Human-readable dari judul (SEO-first) |
| Content rating | Semua termasuk 18+ |
| Age gate | Per-manga, hanya untuk `erotica`/`pornographic` |
| Firestore | Dihapus total |
| Image proxy | Ya — chapter images lewat `/api/proxy-image` |

---

## Arsitektur

```
User Browser
    │
    ▼
Next.js App (Vercel — server-side only ke MangaDex)
    │
    ├─ Server Components / API Routes
    │      │
    │      ▼
    │  MangadexProvider          ←── lib/providers/mangadex.ts
    │      │
    │      ├─ api.mangadex.org/manga
    │      ├─ api.mangadex.org/manga/{id}/feed
    │      ├─ api.mangadex.org/at-home/server/{chapterId}
    │      └─ api.mangadex.org/author, /cover
    │
    ├─ SlugRegistry               ←── lib/providers/mangadex-slug.ts
    │      Map slug ↔ UUID (server memory, lazy-populated)
    │      Fallback: MangaDex title search pada slug miss
    │
    └─ /api/proxy-image           ←── app/api/proxy-image/route.ts
           Fetch at-home images, forward ke browser
           SW cache URL proxy (stabil, tidak expired)
```

Semua request ke `api.mangadex.org` terjadi **server-side only**. User Indonesia tidak terpengaruh blokir Kominfo karena request keluar dari Vercel (US), bukan dari browser.

---

## File Changes

### File Baru
| File | Tanggung jawab |
|---|---|
| `lib/providers/mangadex.ts` | MangadexProvider — implements MangaProvider |
| `lib/providers/mangadex-slug.ts` | SlugRegistry singleton — slug ↔ UUID mapping |
| `app/api/proxy-image/route.ts` | Image proxy — fetch & forward MangaDex CDN images |
| `components/AgeGate.tsx` | Overlay 18+ per-manga (client component) |

### File Dihapus
| File | Alasan |
|---|---|
| `lib/firestore.ts` | Tidak dipakai lagi |
| `lib/providers/keikomik.ts` | Diganti MangadexProvider |
| `lib/providers/keikomik.test.ts` | Provider lama dihapus |

### File Diupdate
| File | Perubahan |
|---|---|
| `lib/providers/index.ts` | Tambah `case 'mangadex': instance = new MangadexProvider()` |
| `lib/config.ts` | Hapus KEIKOMIK_PROJECT_ID + KEIKOMIK_API_KEY, tambah MANGADEX_CONTENT_RATING (optional) |
| `app/manga/[slug]/page.tsx` | Tambah AgeGate component, update generateMetadata |
| `app/chapter/[slug]/[chapter]/page.tsx` | Update generateMetadata (sudah ada, perlu pastikan slug resolve benar) |
| `app/sitemap.ts` | Dynamic sitemap: fetch popular manga + chapter list |
| `public/robots.txt` | Buat file baru: allow semua, disallow `/api/proxy-image` |
| `.env.local` | `MANGA_PROVIDER=mangadex` |

---

## URL Structure

```
/manga/mairimashita-iruma-kun              ← detail manga
/chapter/mairimashita-iruma-kun/121        ← baca chapter
/list?genre=action&sort=update             ← browse (tidak berubah)
```

### Slug Generation

```ts
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // hapus karakter spesial
    .replace(/\s+/g, '-')            // spasi → dash
    .replace(/-+/g, '-')             // multiple dash → satu
    .replace(/^-|-$/g, '')           // trim dash di ujung
}
// "Mairimashita! Iruma-kun" → "mairimashita-iruma-kun"
// "One Piece" → "one-piece"
// "86--Eighty Six" → "86-eighty-six"
```

### SlugRegistry

```ts
// lib/providers/mangadex-slug.ts
class SlugRegistry {
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
    // Conflict: append first 8 chars of UUID
    return `${base}-${uuid.slice(0, 8)}`
  }
}

export const slugRegistry = new SlugRegistry()
```

**Slug resolution flow** (saat `/manga/mairimashita-iruma-kun` diakses):
1. Cek `slugRegistry.getUuid('mairimashita-iruma-kun')` → jika ada, gunakan UUID langsung
2. Jika tidak ada (cold start / slug baru): search MangaDex `GET /manga?title=mairimashita+iruma+kun` → ambil top result → register ke SlugRegistry
3. Jika tetap tidak ketemu: return 404

---

## MangaDex API → MangaProvider Mapping

### MangaCard

| Field | MangaDex Source |
|---|---|
| `id` | `data.id` (UUID) |
| `slug` | `slugRegistry.register(id, title)` |
| `name` | `attributes.title['id']` → `['en']` → nilai pertama yang ada |
| `type` | Tag `"Korean"` → `'Manhwa'`, tag `"Chinese"` → `'Manhua'`, default `'Manga'` |
| `image` | `https://uploads.mangadex.org/covers/{id}/{coverFileName}.256.jpg` |
| `latestChapter` | Nomor chapter terbaru dari feed (lang=`id`, sort desc) |
| `updatedAt` | `attributes.updatedAt` |

### MangaDetail (extends MangaCard)

| Field | MangaDex Source |
|---|---|
| `name2` | `attributes.altTitles` — cari yang `id` atau `ja-ro` |
| `description` | `attributes.description['id']` → `['en']` → `''` |
| `genre` | `attributes.tags` filter `group === 'genre'`, ambil `attributes.name['en']` |
| `demographic` | `attributes.tags` filter `group === 'demographic'` |
| `themes` | `attributes.tags` filter `group === 'theme'` |
| `author` | Dari `relationships` type `'author'` |
| `artist` | Dari `relationships` type `'artist'` |
| `rate` | `attributes.rating.average` (0-10, MangaDex skala 1-10) |
| `status` | `attributes.status`: `'ongoing'`/`'completed'`/`'hiatus'`/`'cancelled'` |
| `rilis` | `attributes.year?.toString()` |
| `chapters` | Dari feed API (lang=`id`), sorted desc |

### ChapterDetail

```ts
// Proses:
// 1. GET /manga?title=slug → dapat UUID (via SlugRegistry)
// 2. GET /manga/{uuid}/feed?translatedLanguage[]=id → cari chapter dengan number === chapterNum
//    Jika tidak ada bahasa id: fallback ke 'en'
//    Jika duplikat (banyak group scan sama chapter): pilih yang paling banyak pages
// 3. GET /at-home/server/{chapterId} → dapat baseUrl + data[]
// 4. Construct image URLs: `${baseUrl}/data/${hash}/${filename}`
// 5. Proxy: return `/api/proxy-image?url=${encodeURIComponent(atHomeUrl)}`

type ChapterDetail = {
  mangaSlug: string     // slug
  mangaName: string
  mangaImage: string
  chapter: number
  pages: string[]       // array URL /api/proxy-image?url=...
  prev: number | null   // nomor chapter sebelumnya
  next: number | null   // nomor chapter berikutnya
}
```

### getGenres()

MangaDex punya 100+ tags. Filter hanya `group === 'genre'`, return nama dalam bahasa Inggris:
```ts
['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports',
 'Supernatural', 'Thriller', 'Isekai', 'Mecha', 'Historical']
```

---

## Image Proxy

```ts
// app/api/proxy-image/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  // Validasi: hanya izinkan domain MangaDex
  const allowed = ['uploads.mangadex.org', 'cmdxd98sb0x3yprd.mangadex.network']
  const hostname = new URL(url).hostname
  if (!allowed.some(d => hostname.endsWith(d))) {
    return new Response('Forbidden', { status: 403 })
  }

  const res = await fetch(url)
  if (!res.ok) return new Response('Upstream error', { status: 502 })

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',  // cache 24 jam di browser/CDN
    },
  })
}
```

URL yang di-cache oleh SW: `/api/proxy-image?url=https%3A%2F%2F...` — stabil, tidak pernah expired.

---

## Age Gate

```tsx
// components/AgeGate.tsx — 'use client'
// Ditampilkan di app/manga/[slug]/page.tsx jika contentRating === 'erotica' | 'pornographic'

// localStorage key: `mikomi_age_{mangaId}`
// Jika key ada: skip gate, tampilkan konten
// Jika tidak ada: tampilkan overlay

// UI: overlay gelap fullscreen
// Teks: "Konten ini khusus 18+"
// Tombol: [Saya berusia 18+] → set localStorage, hide overlay
//          [Kembali]         → router.back()
```

`contentRating` dikirim sebagai prop dari Server Component (page.tsx) ke AgeGate client component.

---

## SEO

### generateMetadata per halaman

**Manga detail** (`app/manga/[slug]/page.tsx`):
```ts
title:       `Baca ${name} Bahasa Indonesia | Mikomi`
description: `Baca manga ${name} bahasa Indonesia online gratis di Mikomi. Genre: ${genres.join(', ')}. Status: ${status}.`
openGraph:   { title, description, images: [coverUrl] }
```

**Chapter page** (`app/chapter/[slug]/[chapter]/page.tsx`):
```ts
title:       `Baca ${mangaName} Chapter ${chapter} Sub Indo | Mikomi`
description: `Baca ${mangaName} chapter ${chapter} bahasa Indonesia online gratis di Mikomi.`
```

### JSON-LD

Di `app/manga/[slug]/page.tsx`, tambah `<script type="application/ld+json">`:
```json
{
  "@context": "https://schema.org",
  "@type": "Book",
  "name": "{mangaName}",
  "inLanguage": "id",
  "genre": ["{genre1}", "{genre2}"],
  "author": { "@type": "Person", "name": "{author}" },
  "numberOfPages": {totalChapters},
  "url": "https://mikomi.vercel.app/manga/{slug}"
}
```

### Dynamic Sitemap

```ts
// app/sitemap.ts — revalidate: 86400
// Fetch 100 manga paling populer dari MangaDex (lang=id)
// Untuk setiap manga: generate URL /manga/{slug}
// Untuk setiap chapter: generate URL /chapter/{slug}/{num}
// Total: ~100 manga × rata-rata 100 chapter = ~10.000 URL per rebuild

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ['/', '/list', '/bookmark', '/history', '/offline']
  const mangaPages  = await fetchTopMangaForSitemap() // max 100 judul
  const chapterPages = mangaPages.flatMap(m =>
    m.chapters.map(ch => ({
      url: `${BASE_URL}/chapter/${m.slug}/${ch.number}`,
      lastModified: ch.updatedAt,
      changeFrequency: 'never' as const,
      priority: 0.6,
    }))
  )
  return [...staticPages.map(p => ({ url: `${BASE_URL}${p}`, priority: 1 })),
          ...mangaPages.map(m => ({ url: `${BASE_URL}/manga/${m.slug}`, priority: 0.8 })),
          ...chapterPages]
}
```

### robots.txt

```
// public/robots.txt
User-agent: *
Allow: /
Disallow: /api/proxy-image
Disallow: /api/

Sitemap: https://mikomi.vercel.app/sitemap.xml
```

---

## ISR & Caching Strategy

| Route | Revalidate | Alasan |
|---|---|---|
| `/` (homepage) | `3600` (1 jam) | Sudah ISR dari sebelumnya |
| `/manga/[slug]` | `3600` (1 jam) | Chapter baru max delay 1 jam |
| `/chapter/[slug]/[num]` | `86400` (1 hari) | Konten tidak berubah |
| `/list` | `force-dynamic` | Filter/sort per-request |
| `/sitemap.xml` | `86400` (1 hari) | Rebuild 1x/hari |

---

## MangaDex API Rate Limit

- Limit: **5 req/detik** per IP
- Next.js ISR + `fetch` caching mengurangi repetitive calls drastically
- Semua `fetch` ke MangaDex menggunakan `next: { revalidate: N }` sehingga hasilnya di-cache di Vercel Data Cache
- Tidak perlu rate-limit manual selama semua fetch pakai Next.js cache

---

## Environment Variables

```bash
# .env.local
MANGA_PROVIDER=mangadex
NEXT_PUBLIC_BASE_URL=https://mikomi.vercel.app

# HAPUS dari Vercel dashboard:
# KEIKOMIK_PROJECT_ID
# KEIKOMIK_API_KEY
```

MangaDex API tidak memerlukan API key untuk read-only access.

---

## Batasan Scope

Yang **tidak** dikerjakan dalam spec ini:
- User authentication / login
- Komentar / rating user
- Notifikasi push untuk chapter baru
- Fitur download ke device (hanya offline PWA cache)
- Multiple scan group selection per chapter
- Webtoon / MangaPlus integration
- Search Console submission (manual step oleh user)
