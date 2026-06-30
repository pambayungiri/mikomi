# Mikomi PWA Audit & Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the PWA offline navigation bug and apply all audit findings — shared storage layer, PWA bug, UX improvements, and component tests.

**Architecture:** Approach C — Foundation first (`lib/storage.ts` shared types + keys), then PWA/bug fixes in parallel, then UX layer (toast, offline banner, confirm dialogs), then tests. Each layer builds on the previous.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, TypeScript, Vitest + @testing-library/react, manual service worker (`public/sw.js`), Fuse.js, localStorage for client state.

## Global Constraints

- Never use `any` type
- All new client components start with `'use client'`
- localStorage access must be inside `try/catch` or use `readStorage`/`writeStorage` from `lib/storage.ts`
- Do not add new npm packages — use only what is already installed
- Follow existing patterns: functional components, no class components
- Test environment: Vitest with jsdom, `@testing-library/jest-dom` matchers, `@` alias resolves to project root
- Run `pnpm test` after every task that touches or creates test files
- Run `pnpm tsc --noEmit` after every task to verify TypeScript

---

## File Map

### New files
- `lib/storage.ts` — shared localStorage types, keys, read/write helpers
- `lib/toast.ts` — CustomEvent-based toast trigger (no Context needed)
- `hooks/useOnlineStatus.ts` — online/offline state hook
- `components/Toaster.tsx` — renders toast notifications in layout
- `components/OfflineBanner.tsx` — sticky banner when offline
- `lib/storage.test.ts` — unit tests for storage helpers
- `components/BookmarkButton.test.tsx` — component tests for BookmarkButton
- `components/RecentSearches.test.tsx` — component tests for RecentSearches

### Modified files
| File | What changes |
|---|---|
| `components/BookmarkButton.tsx` | Task 2: use lib/storage · Task 5: mounted state · Task 6: showToast |
| `components/HistoryTracker.tsx` | Task 2: use lib/storage |
| `components/ContinueReadingSection.tsx` | Task 2: use lib/storage |
| `components/ChapterList.tsx` | Task 2: use lib/storage · Task 6: showToast |
| `components/ChapterReader.tsx` | Task 2: use lib/storage · Task 4: SW message fix |
| `components/GenreFilter.tsx` | Task 3: remove internal GENRES array, use prop |
| `components/RecentSearches.tsx` | Task 2: use lib/storage |
| `app/bookmark/page.tsx` | Task 2: use lib/storage · Task 7: confirm clearAll |
| `app/history/page.tsx` | Task 2: use lib/storage · Task 7: confirm clearAll |
| `app/offline/page.tsx` | Task 2: use lib/storage |
| `app/page.tsx` | Task 4: remove force-dynamic, add revalidate: 3600 |
| `app/chapter/[slug]/[chapter]/page.tsx` | Task 5: add generateMetadata |
| `app/layout.tsx` | Task 6: add Toaster · Task 7: add OfflineBanner |
| `app/sitemap.ts` | Task 3: remove /search, add /offline |
| `public/sw.js` | Task 4: add /manifest.json to STATIC |

---

## Task 1: Shared Storage Layer (lib/storage.ts)

**Files:**
- Create: `lib/storage.ts`
- Create: `lib/storage.test.ts`

**Interfaces produced (used by Tasks 2–8):**
```ts
STORAGE_KEYS.bookmarks      // 'mikomi_bookmarks'
STORAGE_KEYS.history        // 'mikomi_history'
STORAGE_KEYS.readingMode    // 'mikomi_reading_mode'
STORAGE_KEYS.offline        // 'mikomi_offline'
STORAGE_KEYS.recentSearches // 'mikomi_recent_searches'

type BookmarkEntry = { slug: string; name: string; image: string; type: string; latestChapter: number | null }
type HistoryEntry  = { slug: string; chapter: number; mangaName: string; mangaImage: string; timestamp: number }
type OfflineEntry  = { slug: string; chapter: number }

readStorage<T>(key: string, fallback: T): T
writeStorage<T>(key: string, value: T): void
```

- [ ] **Step 1: Write failing tests**

Create `lib/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { readStorage, writeStorage, STORAGE_KEYS } from './storage'

describe('STORAGE_KEYS', () => {
  it('has all expected keys', () => {
    expect(STORAGE_KEYS.bookmarks).toBe('mikomi_bookmarks')
    expect(STORAGE_KEYS.history).toBe('mikomi_history')
    expect(STORAGE_KEYS.readingMode).toBe('mikomi_reading_mode')
    expect(STORAGE_KEYS.offline).toBe('mikomi_offline')
    expect(STORAGE_KEYS.recentSearches).toBe('mikomi_recent_searches')
  })
})

describe('readStorage', () => {
  beforeEach(() => localStorage.clear())

  it('returns fallback when key is absent', () => {
    expect(readStorage('missing', [])).toEqual([])
  })

  it('returns parsed value when key exists', () => {
    localStorage.setItem('test-key', JSON.stringify({ a: 1 }))
    expect(readStorage('test-key', null)).toEqual({ a: 1 })
  })

  it('returns fallback when JSON is corrupted', () => {
    localStorage.setItem('bad', 'not{{json')
    expect(readStorage('bad', 'default')).toBe('default')
  })

  it('returns fallback when stored value is JSON null', () => {
    localStorage.setItem('nullval', 'null')
    expect(readStorage('nullval', 'fallback')).toBe('fallback')
  })
})

describe('writeStorage', () => {
  beforeEach(() => localStorage.clear())

  it('writes serialized value', () => {
    writeStorage('k', [1, 2, 3])
    expect(localStorage.getItem('k')).toBe('[1,2,3]')
  })

  it('overwrites existing value', () => {
    writeStorage('k', 'old')
    writeStorage('k', 'new')
    expect(localStorage.getItem('k')).toBe('"new"')
  })
})
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
pnpm test lib/storage.test.ts
```

Expected: error `Cannot find module './storage'`

- [ ] **Step 3: Implement `lib/storage.ts`**

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
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore quota errors */ }
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
pnpm test lib/storage.test.ts
```

Expected: 8 tests, all PASS

- [ ] **Step 5: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: shared localStorage storage layer with typed helpers"
```

---

## Task 2: Migrate All Components to lib/storage.ts

**Files (all modify only):**
- `components/BookmarkButton.tsx`
- `app/bookmark/page.tsx`
- `components/HistoryTracker.tsx`
- `app/history/page.tsx`
- `components/ContinueReadingSection.tsx`
- `app/offline/page.tsx`
- `components/ChapterList.tsx`
- `components/ChapterReader.tsx`
- `components/RecentSearches.tsx`

This is a pure refactor — zero behavior change. Verify with `pnpm tsc --noEmit` + `pnpm test`.

- [ ] **Step 1: Migrate `components/BookmarkButton.tsx`**

Replace the entire file content with:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { BookmarkEntry } from '@/lib/storage'

export default function BookmarkButton({ manga }: { manga: BookmarkEntry }) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
    setBookmarked(entries.some(e => e.slug === manga.slug))
  }, [manga.slug])

  function toggle() {
    const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
    const isBookmarked = entries.some(e => e.slug === manga.slug)
    const next = isBookmarked
      ? entries.filter(e => e.slug !== manga.slug)
      : [manga, ...entries]
    writeStorage(STORAGE_KEYS.bookmarks, next)
    setBookmarked(!isBookmarked)
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center ${
        bookmarked
          ? 'bg-accent text-white'
          : 'bg-surface-2 text-muted hover:bg-accent hover:text-white'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
      {bookmarked ? 'Favorited' : 'Favorite'}
    </button>
  )
}
```

- [ ] **Step 2: Migrate `app/bookmark/page.tsx`**

At the top of the file, replace the local type and key declarations:

Remove:
```ts
import type { MangaCard as MangaCardType } from '@/lib/providers/types'
type BookmarkEntry = Pick<MangaCardType, 'slug' | 'name' | 'image' | 'type' | 'latestChapter'>
const KEY = 'mikomi_bookmarks'
const HISTORY_KEY = 'mikomi_history'
type LastReadMap = Record<string, number>
```

Add at top (keep existing `useState`, `useMemo`, `Image`, `Link` imports):
```ts
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { BookmarkEntry } from '@/lib/storage'
type LastReadMap = Record<string, number>
```

Then replace all localStorage accesses in the file body:
- `JSON.parse(localStorage.getItem(KEY) ?? '[]')` → `readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])`
- `JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')` → `readStorage<{ slug: string; chapter: number }[]>(STORAGE_KEYS.history, [])`
- `localStorage.setItem(KEY, JSON.stringify(updated))` → `writeStorage(STORAGE_KEYS.bookmarks, updated)`
- `localStorage.removeItem(KEY)` → `writeStorage(STORAGE_KEYS.bookmarks, [])`

- [ ] **Step 3: Migrate `components/HistoryTracker.tsx`**

Replace imports and constants at top:

Remove:
```ts
type HistoryEntry = { slug: string; chapter: number; mangaName: string; mangaImage: string; timestamp: number }
const KEY = 'mikomi_history'
```

Add:
```ts
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { HistoryEntry } from '@/lib/storage'
```

Replace body of `useEffect`:
```ts
useEffect(() => {
  const existing = readStorage<HistoryEntry[]>(STORAGE_KEYS.history, [])
  const filtered = existing.filter(e => !(e.slug === slug && e.chapter === chapter))
  const updated: HistoryEntry[] = [
    { slug, chapter, mangaName, mangaImage, timestamp: Date.now() },
    ...filtered,
  ].slice(0, 100)
  writeStorage(STORAGE_KEYS.history, updated)
}, [slug, chapter, mangaName, mangaImage])
```

- [ ] **Step 4: Migrate `app/history/page.tsx`**

Remove:
```ts
type HistoryEntry = { slug: string; chapter: number; mangaName: string; mangaImage: string; timestamp: number }
const KEY = 'mikomi_history'
```

Add:
```ts
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { HistoryEntry } from '@/lib/storage'
```

Replace all localStorage accesses:
- `JSON.parse(localStorage.getItem(KEY) ?? '[]')` → `readStorage<HistoryEntry[]>(STORAGE_KEYS.history, [])`
- `localStorage.setItem(KEY, JSON.stringify(updated))` → `writeStorage(STORAGE_KEYS.history, updated)`
- `localStorage.removeItem(KEY)` → `writeStorage(STORAGE_KEYS.history, [])`

- [ ] **Step 5: Migrate `components/ContinueReadingSection.tsx`**

Remove:
```ts
type HistoryEntry = { slug: string; chapter: number; mangaName: string; mangaImage: string; timestamp: number }
```

Add import (keep existing React/Image/Link imports):
```ts
import { readStorage, STORAGE_KEYS } from '@/lib/storage'
import type { HistoryEntry } from '@/lib/storage'
```

Replace in `useEffect`:
```ts
const data = readStorage<HistoryEntry[]>(STORAGE_KEYS.history, [])
setHistory(Array.isArray(data) ? data.slice(0, 10) : [])
```

Remove the outer `try/catch` since `readStorage` already handles it.

- [ ] **Step 6: Migrate `app/offline/page.tsx`**

Remove:
```ts
type OfflineEntry = { slug: string; chapter: number }
```

Add:
```ts
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { OfflineEntry } from '@/lib/storage'
```

Replace all `localStorage.getItem('mikomi_offline')` with `readStorage<OfflineEntry[]>(STORAGE_KEYS.offline, [])`.
Replace all `localStorage.setItem('mikomi_offline', JSON.stringify(...))` with `writeStorage(STORAGE_KEYS.offline, ...)`.

- [ ] **Step 7: Migrate `components/ChapterList.tsx`**

Remove inline localStorage key strings and type definitions. The file uses `'mikomi_history'` and `'mikomi_offline'` as string literals inside `useEffect` and `saveOffline`. Replace:

Add import after existing imports:
```ts
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { OfflineEntry } from '@/lib/storage'
```

In `useEffect`, replace:
```ts
const history: { slug: string; chapter: number }[] = JSON.parse(
  localStorage.getItem('mikomi_history') ?? '[]'
)
const offline: { slug: string; chapter: number }[] = JSON.parse(
  localStorage.getItem('mikomi_offline') ?? '[]'
)
```
with:
```ts
const history = readStorage<{ slug: string; chapter: number }[]>(STORAGE_KEYS.history, [])
const offline = readStorage<OfflineEntry[]>(STORAGE_KEYS.offline, [])
```

In `saveOffline`, replace:
```ts
const existing: { slug: string; chapter: number }[] = JSON.parse(
  localStorage.getItem('mikomi_offline') ?? '[]'
)
const updated = [
  ...existing.filter(o => !(o.slug === slug && o.chapter === chapterNum)),
  { slug, chapter: chapterNum },
]
localStorage.setItem('mikomi_offline', JSON.stringify(updated))
```
with:
```ts
const existing = readStorage<OfflineEntry[]>(STORAGE_KEYS.offline, [])
const updated: OfflineEntry[] = [
  ...existing.filter(o => !(o.slug === slug && o.chapter === chapterNum)),
  { slug, chapter: chapterNum },
]
writeStorage(STORAGE_KEYS.offline, updated)
```

- [ ] **Step 8: Migrate `components/ChapterReader.tsx`**

The only localStorage access in ChapterReader is reading the mode preference.

Add import:
```ts
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
```

Remove: `const MODE_KEY = 'mikomi_reading_mode'`

Replace `localStorage.getItem(MODE_KEY)` → `readStorage<string>(STORAGE_KEYS.readingMode, 'strip')`

Replace the `useEffect` that loads mode:
```ts
useEffect(() => {
  const saved = readStorage<string>(STORAGE_KEYS.readingMode, 'strip')
  if (saved === 'single' || saved === 'strip') setMode(saved)
}, [])
```

Replace `localStorage.setItem(MODE_KEY, nextMode)` inside `toggleMode` → `writeStorage(STORAGE_KEYS.readingMode, nextMode)`

- [ ] **Step 9: Migrate `components/RecentSearches.tsx`**

Remove: `const KEY = 'mikomi_recent_searches'`

Add:
```ts
import { STORAGE_KEYS } from '@/lib/storage'
```

Replace `KEY` with `STORAGE_KEYS.recentSearches` throughout the file (used in `localStorage.getItem`, `localStorage.setItem`, `localStorage.removeItem`).

The `saveSearch` exported function also uses `KEY` — update it to use `STORAGE_KEYS.recentSearches` as well.

- [ ] **Step 10: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 11: Run full test suite**

```bash
pnpm test
```

Expected: All existing tests pass (17 tests)

- [ ] **Step 12: Commit**

```bash
git add components/BookmarkButton.tsx app/bookmark/page.tsx \
  components/HistoryTracker.tsx app/history/page.tsx \
  components/ContinueReadingSection.tsx app/offline/page.tsx \
  components/ChapterList.tsx components/ChapterReader.tsx \
  components/RecentSearches.tsx
git commit -m "refactor: centralize localStorage access via lib/storage"
```

---

## Task 3: GenreFilter Fix + Sitemap Fix

**Files:**
- Modify: `components/GenreFilter.tsx`
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Fix GenreFilter — remove internal GENRES array**

In `components/GenreFilter.tsx`, the component has an internal `GENRES` constant that shadows the `genres` prop (which is passed as `_genres` to signal it's unused). Fix this:

Remove the internal constant (lines 14–17):
```ts
const GENRES = [
  'Action', 'Fantasy', 'Adventure', 'Comedy', 'Sci-Fi',
  'Romance', 'Mystery', 'Horror', 'Slice of Life', 'Supernatural', 'Isekai',
]
```

Change the function signature from:
```ts
export default function GenreFilter({
  genres: _genres,
  currentGenre,
  currentSort,
  currentType,
}: {
  genres: string[]
  ...
})
```
to:
```ts
export default function GenreFilter({
  genres,
  currentGenre,
  currentSort,
  currentType,
}: {
  genres: string[]
  ...
})
```

In the dropdown children, change:
```ts
{(GENRES.length ? GENRES : _genres).map(g => (
```
to:
```ts
{genres.map(g => (
```

- [ ] **Step 2: Fix sitemap**

Replace the entire content of `app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mikomi.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/list`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/bookmark`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/history`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/offline`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0.3,
    },
  ]
}
```

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/GenreFilter.tsx app/sitemap.ts
git commit -m "fix: GenreFilter uses genres prop; sitemap removes stale /search route"
```

---

## Task 4: PWA Root Bug Fix + Homepage ISR + SW Manifest

**Files:**
- Modify: `components/ChapterReader.tsx` ← critical fix
- Modify: `app/page.tsx`
- Modify: `public/sw.js`

- [ ] **Step 1: Fix ChapterReader SW message (ROOT BUG)**

In `components/ChapterReader.tsx`, find the `useEffect` that posts to the service worker (around line 61–66 after Task 2 migration). It currently reads:

```ts
useEffect(() => {
  if (!pages.length || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ type: 'CACHE_CHAPTER', urls: pages })
  }).catch(() => {})
}, [pages])
```

Replace with:

```ts
useEffect(() => {
  if (!pages.length || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({
      type: 'CACHE_CHAPTER',
      urls: pages,
      chapterUrl: `/chapter/${slug}/${chapter}`,
      apiUrl:     `/api/chapter/${slug}/${chapter}`,
    })
  }).catch(() => {})
}, [pages, slug, chapter])
```

Note: `slug` and `chapter` must be added to the dependency array since they are now referenced inside the effect.

- [ ] **Step 2: Fix homepage — remove force-dynamic, add ISR**

In `app/page.tsx`, find and replace:

```ts
export const dynamic = 'force-dynamic'
```

with:

```ts
export const revalidate = 3600
```

- [ ] **Step 3: Add manifest.json to SW static pre-cache**

In `public/sw.js`, find line 3:

```js
const STATIC = ['/', '/list', '/bookmark', '/history', '/offline']
```

Replace with:

```js
const STATIC = ['/', '/list', '/bookmark', '/history', '/offline', '/manifest.json']
```

- [ ] **Step 4: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add components/ChapterReader.tsx app/page.tsx public/sw.js
git commit -m "fix: PWA offline navigation — cache chapter HTML+API on read, homepage ISR"
```

---

## Task 5: Bug Fixes (Hydration Flash + Chapter Metadata)

**Files:**
- Modify: `components/BookmarkButton.tsx`
- Modify: `app/chapter/[slug]/[chapter]/page.tsx`

- [ ] **Step 1: Fix BookmarkButton hydration flash**

Replace the entire content of `components/BookmarkButton.tsx` with the version that adds a `mounted` guard:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { readStorage, writeStorage, STORAGE_KEYS } from '@/lib/storage'
import type { BookmarkEntry } from '@/lib/storage'

export default function BookmarkButton({ manga }: { manga: BookmarkEntry }) {
  const [mounted, setMounted] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
    setBookmarked(entries.some(e => e.slug === manga.slug))
    setMounted(true)
  }, [manga.slug])

  function toggle() {
    const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
    const isBookmarked = entries.some(e => e.slug === manga.slug)
    const next = isBookmarked
      ? entries.filter(e => e.slug !== manga.slug)
      : [manga, ...entries]
    writeStorage(STORAGE_KEYS.bookmarks, next)
    setBookmarked(!isBookmarked)
  }

  if (!mounted) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-surface-2 text-muted w-full justify-center opacity-60 cursor-default"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        </svg>
        Favorite
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center ${
        bookmarked
          ? 'bg-accent text-white'
          : 'bg-surface-2 text-muted hover:bg-accent hover:text-white'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
      {bookmarked ? 'Favorited' : 'Favorite'}
    </button>
  )
}
```

- [ ] **Step 2: Add generateMetadata to chapter page**

In `app/chapter/[slug]/[chapter]/page.tsx`, add the following imports at the top (after existing imports):

```ts
import type { Metadata } from 'next'
```

Then add `generateMetadata` immediately before the `ChapterPage` default export:

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

- [ ] **Step 3: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/BookmarkButton.tsx app/chapter/[slug]/[chapter]/page.tsx
git commit -m "fix: bookmark hydration flash, chapter page SEO metadata"
```

---

## Task 6: Toast System

**Files:**
- Create: `lib/toast.ts`
- Create: `components/Toaster.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/BookmarkButton.tsx`
- Modify: `components/ChapterList.tsx`

- [ ] **Step 1: Create `lib/toast.ts`**

```ts
export type ToastType = 'success' | 'info' | 'error'

export function showToast(message: string, type: ToastType = 'success'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('mikomi-toast', { detail: { message, type } })
  )
}
```

- [ ] **Step 2: Create `components/Toaster.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { ToastType } from '@/lib/toast'

type Toast = { id: number; message: string; type: ToastType }

export default function Toaster() {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    function handle(e: Event) {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      setToast({ id: Date.now(), message, type })
    }
    window.addEventListener('mikomi-toast', handle)
    return () => window.removeEventListener('mikomi-toast', handle)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast?.id])

  if (!toast) return null

  const accentClass = {
    success: 'text-accent',
    info:    'text-muted',
    error:   'text-accent-2',
  }[toast.type]

  const icon = { success: '✓', info: 'ℹ', error: '✕' }[toast.type]

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 right-4 z-[200] flex items-center gap-2.5 bg-surface border border-border rounded-xl px-4 py-3 shadow-2xl text-sm text-fg"
    >
      <span className={`font-bold ${accentClass}`} aria-hidden="true">{icon}</span>
      {toast.message}
    </div>
  )
}
```

- [ ] **Step 3: Add Toaster to layout**

In `app/layout.tsx`, add the import:
```ts
import Toaster from '@/components/Toaster'
```

Add `<Toaster />` just before the closing `</body>` tag (after `<BottomNav />`):
```tsx
        <BottomNav />
        <Toaster />
      </body>
```

- [ ] **Step 4: Add toast to BookmarkButton**

In `components/BookmarkButton.tsx`, add import:
```ts
import { showToast } from '@/lib/toast'
```

In the `toggle` function, after `setBookmarked(!isBookmarked)`, add:
```ts
showToast(isBookmarked ? 'Removed from favorites' : 'Added to favorites', isBookmarked ? 'info' : 'success')
```

The full updated `toggle` function:
```ts
function toggle() {
  const entries = readStorage<BookmarkEntry[]>(STORAGE_KEYS.bookmarks, [])
  const isBookmarked = entries.some(e => e.slug === manga.slug)
  const next = isBookmarked
    ? entries.filter(e => e.slug !== manga.slug)
    : [manga, ...entries]
  writeStorage(STORAGE_KEYS.bookmarks, next)
  setBookmarked(!isBookmarked)
  showToast(
    isBookmarked ? 'Removed from favorites' : 'Added to favorites',
    isBookmarked ? 'info' : 'success'
  )
}
```

- [ ] **Step 5: Add toast to ChapterList**

In `components/ChapterList.tsx`, add import:
```ts
import { showToast } from '@/lib/toast'
```

In `saveOffline`, find the try/catch and update:
```ts
async function saveOffline(chapterNum: number) {
  if (saving !== null || saved.has(chapterNum)) return
  setSaving(chapterNum)
  try {
    const res = await fetch(`/api/chapter/${slug}/${chapterNum}`)
    if (!res.ok) throw new Error('fetch failed')
    const { pages } = await res.json() as { pages: string[] }

    const reg = await navigator.serviceWorker.ready
    reg.active?.postMessage({
      type: 'CACHE_CHAPTER',
      urls: pages,
      chapterUrl: `/chapter/${slug}/${chapterNum}`,
      apiUrl: `/api/chapter/${slug}/${chapterNum}`,
    })

    const existing = readStorage<OfflineEntry[]>(STORAGE_KEYS.offline, [])
    const updated: OfflineEntry[] = [
      ...existing.filter(o => !(o.slug === slug && o.chapter === chapterNum)),
      { slug, chapter: chapterNum },
    ]
    writeStorage(STORAGE_KEYS.offline, updated)
    setSaved(prev => new Set([...prev, chapterNum]))
    showToast('Chapter saved for offline reading')
  } catch {
    showToast('Failed to save chapter', 'error')
  }
  setSaving(null)
}
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Run full test suite**

```bash
pnpm test
```

Expected: All existing tests pass

- [ ] **Step 8: Commit**

```bash
git add lib/toast.ts components/Toaster.tsx app/layout.tsx \
  components/BookmarkButton.tsx components/ChapterList.tsx
git commit -m "feat: toast notification system — bookmark toggle and offline save feedback"
```

---

## Task 7: UX Polish (Confirm Dialogs + Offline Banner)

**Files:**
- Create: `hooks/useOnlineStatus.ts`
- Create: `components/OfflineBanner.tsx`
- Modify: `app/history/page.tsx`
- Modify: `app/bookmark/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `hooks/useOnlineStatus.ts`**

```ts
'use client'

import { useState, useEffect } from 'react'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(navigator.onLine)
    const on  = () => setOnline(true)
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

- [ ] **Step 2: Create `components/OfflineBanner.tsx`**

```tsx
'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="sticky top-14 z-40 flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-400 text-xs font-medium">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      You&apos;re offline — only saved chapters are available
    </div>
  )
}
```

- [ ] **Step 3: Add OfflineBanner to layout**

In `app/layout.tsx`, add import:
```ts
import OfflineBanner from '@/components/OfflineBanner'
```

Add `<OfflineBanner />` between `<Nav />` and `<main>`:
```tsx
        <Nav />
        <OfflineBanner />
        <main id="main-content" className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-6 pb-24 md:pb-6">{children}</main>
```

- [ ] **Step 4: Add confirm to clearAll in `app/history/page.tsx`**

Find the `clearAll` function:
```ts
function clearAll() {
  localStorage.removeItem(KEY)
  setHistory([])
}
```

Replace with (using `writeStorage` which was already migrated in Task 2):
```ts
function clearAll() {
  if (!window.confirm('Clear all reading history? This cannot be undone.')) return
  writeStorage(STORAGE_KEYS.history, [])
  setHistory([])
}
```

- [ ] **Step 5: Add confirm to clearAll in `app/bookmark/page.tsx`**

Find the `clearAll` function:
```ts
function clearAll() {
  localStorage.removeItem(KEY)
  setBookmarks([])
}
```

Replace with:
```ts
function clearAll() {
  if (!window.confirm('Remove all favorites? This cannot be undone.')) return
  writeStorage(STORAGE_KEYS.bookmarks, [])
  setBookmarks([])
}
```

- [ ] **Step 6: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add hooks/useOnlineStatus.ts components/OfflineBanner.tsx \
  app/layout.tsx app/history/page.tsx app/bookmark/page.tsx
git commit -m "feat: offline banner, confirm dialogs for destructive clear actions"
```

---

## Task 8: Component Tests

**Files:**
- Create: `components/BookmarkButton.test.tsx`
- Create: `components/RecentSearches.test.tsx`

- [ ] **Step 1: Write BookmarkButton tests**

Create `components/BookmarkButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BookmarkButton from './BookmarkButton'

vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }))

const { showToast } = await import('@/lib/toast')

const manga = {
  slug: 'test-slug',
  name: 'Test Manga',
  image: 'https://example.com/cover.jpg',
  type: 'Manga',
  latestChapter: 5,
}

describe('BookmarkButton', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders disabled skeleton before hydration, then shows Favorite', async () => {
    render(<BookmarkButton manga={manga} />)
    // After useEffect fires, mounted becomes true
    const button = await screen.findByRole('button', { name: /favorite/i })
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('Favorite')
  })

  it('shows Favorited when manga is already bookmarked in localStorage', async () => {
    localStorage.setItem('mikomi_bookmarks', JSON.stringify([manga]))
    render(<BookmarkButton manga={manga} />)
    const button = await screen.findByRole('button')
    expect(button).toHaveTextContent('Favorited')
  })

  it('adds bookmark and shows success toast on click when not bookmarked', async () => {
    render(<BookmarkButton manga={manga} />)
    const button = await screen.findByRole('button', { name: /favorite/i })
    fireEvent.click(button)
    expect(vi.mocked(showToast)).toHaveBeenCalledWith('Added to favorites', 'success')
    const stored = JSON.parse(localStorage.getItem('mikomi_bookmarks') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('test-slug')
  })

  it('removes bookmark and shows info toast on click when already bookmarked', async () => {
    localStorage.setItem('mikomi_bookmarks', JSON.stringify([manga]))
    render(<BookmarkButton manga={manga} />)
    const button = await screen.findByRole('button')
    fireEvent.click(button)
    expect(vi.mocked(showToast)).toHaveBeenCalledWith('Removed from favorites', 'info')
    const stored = JSON.parse(localStorage.getItem('mikomi_bookmarks') ?? '[]')
    expect(stored).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run BookmarkButton tests — confirm they FAIL**

```bash
pnpm test components/BookmarkButton.test.tsx
```

Expected: FAIL — `showToast` not yet wired to BookmarkButton (it was added in Task 6, so these should PASS if Task 6 is done). If Task 6 is complete, these will pass. If tests are written before Task 6, they will fail on the toast assertions.

- [ ] **Step 3: Write RecentSearches tests**

Create `components/RecentSearches.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecentSearches from './RecentSearches'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('RecentSearches', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders nothing when localStorage has no recent searches', () => {
    const { container } = render(<RecentSearches />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders recent searches stored in localStorage', async () => {
    localStorage.setItem('mikomi_recent_searches', JSON.stringify(['naruto', 'one piece']))
    render(<RecentSearches />)
    expect(await screen.findByText('naruto')).toBeInTheDocument()
    expect(screen.getByText('one piece')).toBeInTheDocument()
  })

  it('navigates to /list?q= when a recent search is clicked', async () => {
    localStorage.setItem('mikomi_recent_searches', JSON.stringify(['bleach']))
    render(<RecentSearches />)
    fireEvent.click(await screen.findByText('bleach'))
    expect(mockPush).toHaveBeenCalledWith('/list?q=bleach')
  })

  it('clears recent searches and hides component when Clear is clicked', async () => {
    localStorage.setItem('mikomi_recent_searches', JSON.stringify(['naruto']))
    const { container } = render(<RecentSearches />)
    fireEvent.click(await screen.findByText('Clear'))
    expect(localStorage.getItem('mikomi_recent_searches')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All tests pass. Count should be: 8 (storage) + 17 (existing) + 4 (BookmarkButton) + 4 (RecentSearches) = 33 tests, all PASS

- [ ] **Step 5: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Final commit**

```bash
git add components/BookmarkButton.test.tsx components/RecentSearches.test.tsx
git commit -m "test: component tests for BookmarkButton and RecentSearches"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Layer 1 (Tasks 1–2), Layer 2 (Task 4), Layer 3 (Tasks 3, 5), Layer 4 (Tasks 6–7), Layer 5 (Task 8) — all 14 spec items covered
- [x] **No placeholders:** All code blocks are complete and concrete
- [x] **Type consistency:** `BookmarkEntry`, `HistoryEntry`, `OfflineEntry` defined in Task 1 and used consistently in Tasks 2–8. `showToast` signature in Task 6 matches `lib/toast.ts` defined in same task. `useOnlineStatus` returns `boolean` and used correctly in Task 7.
- [x] **Dependency order:** Task 2 uses `lib/storage.ts` (Task 1 ✓). Task 4 builds on Task 2 migration (ChapterReader already uses `STORAGE_KEYS` before SW fix). Task 5 builds on Task 2 (BookmarkButton). Task 6 adds toast to BookmarkButton after Task 5 adds `mounted`. Task 7 adds confirm after Task 2 migration. Task 8 tests components after all behavior changes.
- [x] **ChapterList SW message:** Task 6 Step 5 also adds `chapterUrl`/`apiUrl` to `saveOffline`'s postMessage — consistent with the SW fix in Task 4.
