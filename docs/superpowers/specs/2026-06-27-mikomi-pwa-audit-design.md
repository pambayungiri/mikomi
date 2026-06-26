# Mikomi — PWA Audit & Enhancement Design

**Date:** 2026-06-27
**Branch:** main (post-merge dari claude/location-check-dyszfh)
**Approach:** C — Foundation → Bugs → UX → Tests

---

## Scope

Semua bug dan enhancement yang ditemukan dari audit menyeluruh post-merge. Tidak ada fitur baru di luar list ini. Urutan pengerjaan wajib diikuti karena tiap layer bergantung pada layer sebelumnya.

---

## Layer 1 — Foundation (Shared Storage Layer)

### 1.1 Buat `lib/storage.ts`

File baru ini adalah sumber kebenaran tunggal untuk semua localStorage interaction.

**Isi yang harus ada:**

```ts
export const STORAGE_KEYS = {
  bookmarks:      'mikomi_bookmarks',
  history:        'mikomi_history',
  readingMode:    'mikomi_reading_mode',
  offline:        'mikomi_offline',
  recentSearches: 'mikomi_recent_searches',
} as const

export type BookmarkEntry = {
  slug: string
  name: string
  image: string
  type: string
  latestChapter: number | null
}

export type HistoryEntry = {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
  timestamp: number
}

export type OfflineEntry = { slug: string; chapter: number }

export function readStorage<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}

export function writeStorage<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch { /* ignore quota errors */ }
}
```

### 1.2 Migrate semua komponen ke `lib/storage.ts`

File-file yang harus di-update (hapus definisi lokal, ganti dengan import):

| File | Yang dihapus | Yang diimport |
|---|---|---|
| `components/BookmarkButton.tsx` | `type BookmarkEntry`, key literal `'mikomi_bookmarks'`, `load()`, `save()` | `BookmarkEntry`, `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `app/bookmark/page.tsx` | `type BookmarkEntry`, key literal | `BookmarkEntry`, `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `components/HistoryTracker.tsx` | `type HistoryEntry`, key literal | `HistoryEntry`, `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `app/history/page.tsx` | `type HistoryEntry`, key literal | `HistoryEntry`, `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `components/ContinueReadingSection.tsx` | `type HistoryEntry`, key literal | `HistoryEntry`, `STORAGE_KEYS`, `readStorage` |
| `app/offline/page.tsx` | `type OfflineEntry`, key literal | `OfflineEntry`, `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `components/ChapterList.tsx` | key literals, inline parse | `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `components/ChapterReader.tsx` | key literal untuk reading mode | `STORAGE_KEYS`, `readStorage`, `writeStorage` |
| `components/RecentSearches.tsx` | key literal | `STORAGE_KEYS` (KEY constant diganti) |

### 1.3 Fix `GenreFilter` — gunakan prop `genres`

`components/GenreFilter.tsx` punya array `GENRES` internal yang hardcoded dan mengabaikan prop `genres` yang diterima. Hapus array internal, rename parameter `_genres` → `genres`, pakai prop tersebut.

---

## Layer 2 — PWA Bug Fixes

### 2.1 Fix ChapterReader SW message (B0 — ROOT BUG)

**File:** `components/ChapterReader.tsx` baris ~63-65

**Sekarang (salah):**
```ts
reg.active?.postMessage({ type: 'CACHE_CHAPTER', urls: pages })
```

**Harus jadi:**
```ts
reg.active?.postMessage({
  type: 'CACHE_CHAPTER',
  urls: pages,
  chapterUrl: `/chapter/${slug}/${chapter}`,
  apiUrl:     `/api/chapter/${slug}/${chapter}`,
})
```

**Kenapa ini bug utama:** SW handler `CACHE_CHAPTER` menggunakan `e.data.chapterUrl` dan `e.data.apiUrl` untuk cache HTML halaman dan API response. Tanpa keduanya, hanya gambar yang di-cache. Saat offline, navigate ke chapter yang pernah dibaca → SW tidak temukan HTML di cache → fallback ke `/offline` atau `/`. Inilah akar masalah offline navigation.

### 2.2 Homepage — ubah dari `force-dynamic` ke ISR

**File:** `app/page.tsx`

Hapus `export const dynamic = 'force-dynamic'`, ganti dengan:
```ts
export const revalidate = 3600
```

**Kenapa:** SW pre-cache `'/'` saat install. Kalau homepage `force-dynamic`, respons bergantung pada Firestore dan tidak bisa di-serve dari cache dengan andal. ISR 3600s (1 jam) membuat Next.js generate static HTML yang bisa di-cache SW dengan benar. Data stale 1 jam itu acceptable untuk homepage manga reader.

### 2.3 SW — tambah `/manifest.json` ke STATIC pre-cache

**File:** `public/sw.js`

```js
const STATIC = ['/', '/list', '/bookmark', '/history', '/offline', '/manifest.json']
```

---

## Layer 3 — Bug Fixes

### 3.1 Sitemap fix (B2)

**File:** `app/sitemap.ts`

- Hapus entry `/search` — route ini sekarang hanya redirect ke `/list`
- Ganti dengan `/offline`
- Perbarui `changeFrequency` dan `priority` yang sesuai

### 3.2 BookmarkButton hydration flash (B3)

**File:** `components/BookmarkButton.tsx`

Tambah state `mounted` agar button tidak berkedip dari "Bookmark" ke state yang benar:

```tsx
const [mounted, setMounted] = useState(false)
const [bookmarked, setBookmarked] = useState(false)

useEffect(() => {
  setMounted(true)
  const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
  setBookmarked(entries.some(e => e.slug === manga.slug))
}, [manga.slug])

if (!mounted) return (
  <button disabled className="... opacity-60 cursor-default">
    Bookmark
  </button>
)
```

### 3.3 Chapter page generateMetadata (B4)

**File:** `app/chapter/[slug]/[chapter]/page.tsx`

Tambah `generateMetadata` sebelum page component:

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
      title: `${manga.name} — Chapter ${chapter} | Mikomi`,
      description: `Read ${manga.name} Chapter ${chapter} on Mikomi.`,
      openGraph: {
        title: `${manga.name} — Chapter ${chapter}`,
        images: manga.image ? [{ url: manga.image, alt: manga.name }] : [],
      },
    }
  } catch {
    return { title: `Chapter ${chapter} — Mikomi` }
  }
}
```

Import `Metadata` dari `'next'` dan `getProvider` dari `'@/lib/providers'`.

---

## Layer 4 — UX Improvements

### 4.1 Toast System

**File baru:** `lib/toast.ts` + `components/Toaster.tsx`

**`lib/toast.ts`** — event bus berbasis CustomEvent, tidak butuh Context:
```ts
export function showToast(
  message: string,
  type: 'success' | 'info' | 'error' = 'success'
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('mikomi-toast', { detail: { message, type } })
  )
}
```

**`components/Toaster.tsx`** — client component, dipasang di `app/layout.tsx`:
- Listen event `'mikomi-toast'`
- Render toast di pojok kanan bawah (di atas BottomNav — `bottom: 72px` on mobile, `bottom: 16px` on desktop)
- Auto-dismiss setelah 3 detik
- Max 1 toast tampil sekaligus (baru replace lama)
- Styling: `bg-surface border border-border rounded-xl px-4 py-3 shadow-xl`
- Icon kecil: ✓ untuk success, ℹ untuk info, ✕ untuk error
- Slide-up + fade-in animation via Tailwind `translate-y` + `opacity`

**Penggunaan di komponen:**
- `BookmarkButton.tsx`: `showToast('Added to favorites')` / `showToast('Removed from favorites', 'info')`
- `ChapterList.tsx`: `showToast('Chapter saved for offline reading')` saat download selesai, `showToast('Failed to save', 'error')` saat gagal

### 4.2 Confirm "Clear All"

**File:** `app/history/page.tsx` dan `app/bookmark/page.tsx`

Gunakan `window.confirm()` — tidak butuh komponen baru, accessible, native:

```ts
function clearAll() {
  if (!window.confirm('Clear all reading history? This cannot be undone.')) return
  writeStorage(STORAGE_KEYS.history, [])
  setHistory([])
}
```

Untuk bookmark:
```ts
function clearAll() {
  if (!window.confirm('Remove all favorites? This cannot be undone.')) return
  writeStorage(STORAGE_KEYS.bookmarks, [])
  setBookmarks([])
}
```

### 4.3 Offline Status Indicator

**File baru:** `hooks/useOnlineStatus.ts` + `components/OfflineBanner.tsx`

**`hooks/useOnlineStatus.ts`:**
```ts
'use client'
import { useState, useEffect } from 'react'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
```

**`components/OfflineBanner.tsx`:**
- Pakai `useOnlineStatus()`
- Render banner `"You're offline — showing saved content"` saat `!online`
- Posisi: sticky di bawah Nav (`top-14`), di atas konten
- Warna: `bg-amber-500/10 border-b border-amber-500/30 text-amber-400`
- Sertakan icon wifi-off
- Dipasang di `app/layout.tsx` antara `<Nav />` dan `<main>`

---

## Layer 5 — Testing

### 5.1 `lib/storage.test.ts`

Test `readStorage` dan `writeStorage`:
- Parse normal data
- Fallback saat key tidak ada
- Fallback saat data corrupted (invalid JSON)
- `writeStorage` menimpa nilai lama

### 5.2 `components/BookmarkButton.test.tsx`

- Render dengan manga yang belum di-bookmark → button bertuliskan "Bookmark"
- Klik → state berubah jadi bookmarked
- Klik lagi → kembali ke tidak bookmarked
- Toast `showToast` dipanggil dengan pesan yang benar

### 5.3 `components/RecentSearches.test.tsx`

- Tidak render saat localStorage kosong
- Render recent searches dari localStorage
- Klik item → navigasi ke `/list?q=...`
- Klik "Clear" → localStorage dikosongkan, komponen hilang

---

## Batasan Scope (Jangan Dikerjakan)

Hal-hal berikut **tidak** masuk scope design ini:

- E2E testing (Playwright/Cypress) — investasi tersendiri
- Redesign visual/tema baru
- Tambah provider manga baru
- Fitur komentar / rating user
- Auth / login
- Notifikasi chapter baru
- Refactor arsitektur besar di luar yang disebutkan

---

## Urutan Pengerjaan (Wajib Diikuti)

```
Layer 1 (Foundation — harus selesai SEBELUM layer lainnya)
  1.1  lib/storage.ts — buat file baru
  1.2  Migrate semua komponen (9 file)
  1.3  Fix GenreFilter

Layer 2 + 3 (setelah Layer 1 selesai — Layer 2 dan 3 bisa paralel satu sama lain)
  2.1  ChapterReader SW message fix     [CRITICAL]
  2.2  Homepage ISR                     [PWA]
  2.3  SW manifest entry                [PWA]
  3.1  Sitemap fix                      [SEO]
  3.2  BookmarkButton hydration flash   [Bug]
  3.3  Chapter generateMetadata         [SEO]

Layer 4 (UX — setelah Layer 1-3 semua selesai)
  4.1  lib/toast.ts + Toaster component
  4.2  Confirm Clear All (history + bookmark)
  4.3  useOnlineStatus hook + OfflineBanner

Layer 5 (Tests — terakhir, setelah semua layer selesai)
  5.1  lib/storage.test.ts
  5.2  BookmarkButton.test.tsx
  5.3  RecentSearches.test.tsx
```

---

## File yang Akan Dibuat (Baru)

- `lib/storage.ts`
- `lib/toast.ts`
- `hooks/useOnlineStatus.ts`
- `components/Toaster.tsx`
- `components/OfflineBanner.tsx`
- `lib/storage.test.ts`
- `components/BookmarkButton.test.tsx`
- `components/RecentSearches.test.tsx`

## File yang Akan Dimodifikasi

- `components/BookmarkButton.tsx`
- `components/HistoryTracker.tsx`
- `components/ContinueReadingSection.tsx`
- `components/ChapterList.tsx`
- `components/ChapterReader.tsx` ← PWA root bug fix ada di sini
- `components/GenreFilter.tsx`
- `components/RecentSearches.tsx`
- `app/bookmark/page.tsx`
- `app/history/page.tsx`
- `app/offline/page.tsx`
- `app/page.tsx` ← ISR fix
- `app/chapter/[slug]/[chapter]/page.tsx` ← generateMetadata
- `app/layout.tsx` ← tambah Toaster + OfflineBanner
- `app/sitemap.ts`
- `public/sw.js` ← tambah manifest ke STATIC
