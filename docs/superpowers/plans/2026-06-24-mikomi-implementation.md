# Mikomi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Mikomi — a manga/manhwa/manhua reading site that reads from keikomik's publicly-readable Firebase Firestore database, with significantly better UI/UX than the source site.

**Architecture:** Next.js 16 App Router with Server Components fetching data via the Firestore REST API (no Firebase SDK). A `MangaProvider` interface wraps all data access so the source can be swapped via `MANGA_PROVIDER` env var. Bookmark/history are localStorage-only client components.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, Vitest, pnpm, Vercel

## Global Constraints

- Next.js 16: `params` and `searchParams` are Promises — always `await` before destructuring
- Tailwind v4: all theme tokens in `app/globals.css` inside `@theme {}` — never in `tailwind.config.ts`
- Pages call `getProvider()` directly — never `fetch('/api/...')` from server components
- Search page uses `export const dynamic = "force-dynamic"` — all other data pages use `export const revalidate`
- Filter out documents where `status === 'tutup'` client-side (can't use `!=` in Firestore without composite index)
- Firestore `runQuery` endpoint: `POST https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents:runQuery?key={API_KEY}`
- Collection name: `KomikApp` (capital K and A — exact match required)
- Reading mode localStorage key: `mikomi_reading_mode`
- Bookmarks localStorage key: `mikomi_bookmarks`
- History localStorage key: `mikomi_history` (max 100 entries, newest first)
- Repo name: `mikomi`, deployed to Vercel

---

## File Map

```
mikomi/
├── app/
│   ├── globals.css               # Tailwind v4 theme tokens + base styles
│   ├── layout.tsx                # Root layout: Nav + children + Footer
│   ├── page.tsx                  # Homepage: popular carousel + update row + new arrivals
│   ├── list/page.tsx             # Browse: genre filter + sort + paginated grid
│   ├── manga/[slug]/page.tsx     # Manga detail: sidebar + chapter list
│   ├── chapter/[slug]/[chapter]/page.tsx  # Chapter reader (server data)
│   ├── search/page.tsx           # Search results (force-dynamic)
│   ├── bookmark/page.tsx         # Bookmarks (client, localStorage)
│   └── history/page.tsx          # History (client, localStorage)
├── components/
│   ├── Nav.tsx                   # Top navigation bar
│   ├── Footer.tsx                # Page footer
│   ├── MangaCard.tsx             # Reusable card with type badge (used everywhere)
│   ├── HeroCarousel.tsx          # Client: auto-scrolling carousel for popular
│   ├── GenreFilter.tsx           # Client: genre pills + sort toggle → router.push
│   ├── SearchBar.tsx             # Client: debounced input → router.replace
│   ├── ChapterReader.tsx         # Client: long-strip/single-page mode toggle + keyboard nav
│   ├── BookmarkButton.tsx        # Client: localStorage bookmark toggle
│   └── HistoryTracker.tsx        # Client: writes chapter visit to localStorage on mount
└── lib/
    ├── config.ts                 # Env var validation (throws on missing)
    ├── firestore.ts              # runQuery() + parseValue() + parseDoc()
    └── providers/
        ├── types.ts              # MangaProvider interface + all shared types
        ├── keikomik.ts           # KeikomikProvider: all 7 provider methods
        └── index.ts              # getProvider() factory
```

---

## Task 1: Project Setup + Theme + Layout

**Files:**
- Create: `mikomi/` (via `pnpm create next-app@latest`)
- Modify: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `components/Nav.tsx`
- Create: `components/Footer.tsx`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.local`

**Interfaces:**
- Produces: root layout with Nav + Footer, Tailwind v4 theme tokens, Vitest runner

- [ ] **Step 1: Scaffold the project**

```bash
cd /Users/marshpotao/Projects
pnpm create next-app@latest mikomi --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
cd mikomi
```

When prompted: TypeScript ✅, ESLint ✅, Tailwind ✅, App Router ✅, no src/ dir, `@/*` alias.

- [ ] **Step 2: Add Vitest**

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Replace `app/globals.css` with Tailwind v4 theme**

```css
@import "tailwindcss";

@theme {
  --color-bg:        #0d0d12;
  --color-surface:   #13131a;
  --color-surface-2: #1c1c26;
  --color-accent:    #7c6aff;
  --color-accent-2:  #e040a0;
  --color-gold:      #f59e0b;
  --color-muted:     #6b7280;
  --color-border:    #232330;
  --color-fg:        #f0f0f8;
}

body {
  background-color: #0d0d12;
  color: #f0f0f8;
}
```

- [ ] **Step 7: Create `components/Nav.tsx`**

```tsx
import Link from 'next/link'

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-accent">
          Mikomi
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/list" className="text-muted hover:text-fg transition-colors">Browse</Link>
          <Link href="/bookmark" className="text-muted hover:text-fg transition-colors">Bookmark</Link>
          <Link href="/history" className="text-muted hover:text-fg transition-colors">History</Link>
          <Link href="/search" className="text-muted hover:text-fg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 8: Create `components/Footer.tsx`**

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-border mt-16 py-8 text-center text-sm text-muted">
      <p>© {new Date().getFullYear()} Mikomi. For personal use only.</p>
    </footer>
  )
}
```

- [ ] **Step 9: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mikomi — Read Manga, Manhwa, Manhua',
  description: 'Read manga, manhwa, and manhua online.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-bg text-fg min-h-screen`}>
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 10: Delete boilerplate**

```bash
rm -f app/page.tsx  # will be replaced in Task 5
# Keep: app/layout.tsx, app/globals.css
```

- [ ] **Step 11: Create `.env.local`**

```env
MANGA_PROVIDER=keikomik
KEIKOMIK_PROJECT_ID=komikapp-677a0
KEIKOMIK_API_KEY=AIzaSyC6Jm-c0blt4T7JxBuMmoh5QNHaRQ0vgJI
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 12: Verify dev server starts**

```bash
pnpm dev
```

Expected: server starts on http://localhost:3000, page shows (may 404 — no page.tsx yet, that's fine).

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold mikomi — Next.js 16, Tailwind v4 theme, layout, Vitest"
```

---

## Task 2: Types + Config + Firestore Wrapper

**Files:**
- Create: `lib/config.ts`
- Create: `lib/providers/types.ts`
- Create: `lib/firestore.ts`
- Create: `lib/firestore.test.ts`

**Interfaces:**
- Produces:
  - `getConfig(): { KEIKOMIK_PROJECT_ID: string; KEIKOMIK_API_KEY: string; MANGA_PROVIDER: string }`
  - `runQuery(query: StructuredQuery): Promise<unknown[]>`
  - `MangaProvider` interface
  - All shared types: `MangaCard`, `MangaDetail`, `ChapterMeta`, `ChapterDetail`, `PaginatedResult`

- [ ] **Step 1: Create `lib/config.ts`**

```typescript
export function getConfig() {
  const MANGA_PROVIDER = process.env.MANGA_PROVIDER ?? 'keikomik'
  const KEIKOMIK_PROJECT_ID = process.env.KEIKOMIK_PROJECT_ID
  const KEIKOMIK_API_KEY = process.env.KEIKOMIK_API_KEY

  if (!KEIKOMIK_PROJECT_ID) throw new Error('Missing env: KEIKOMIK_PROJECT_ID')
  if (!KEIKOMIK_API_KEY) throw new Error('Missing env: KEIKOMIK_API_KEY')

  return { MANGA_PROVIDER, KEIKOMIK_PROJECT_ID, KEIKOMIK_API_KEY }
}
```

- [ ] **Step 2: Create `lib/providers/types.ts`**

```typescript
export type MangaCard = {
  id: string
  slug: string
  name: string
  type: string           // "Manga" | "Manhwa" | "Manhua"
  image: string
  latestChapter: number | null
  updatedAt: string      // ISO timestamp string
}

export type ChapterMeta = {
  number: number
  updatedAt: string
  note: string
}

export type MangaDetail = MangaCard & {
  name2: string
  description: string
  genre: string[]
  demographic: string[]
  themes: string[]
  author: string
  artist: string
  rate: number
  status: string         // "Ongoing" | "Completed" | "Hiatus"
  rilis: string
  chapters: ChapterMeta[]
}

export type ChapterDetail = {
  mangaSlug: string
  mangaName: string
  mangaImage: string
  chapter: number
  pages: string[]
  prev: number | null
  next: number | null
}

export type PaginatedResult<T> = {
  data: T[]
  nextCursor: string | null  // ISO timestamp of last item's UpdateAt for startAfter
  hasMore: boolean
}

export interface MangaProvider {
  getPopular(): Promise<MangaCard[]>
  getLatestUpdate(): Promise<MangaCard[]>
  getNewArrivals(): Promise<MangaCard[]>
  getList(opts: {
    genre?: string
    sort?: 'update' | 'create'
    after?: string
  }): Promise<PaginatedResult<MangaCard>>
  getManga(slug: string): Promise<MangaDetail>
  getChapter(slug: string, chapter: number): Promise<ChapterDetail>
  search(query: string): Promise<MangaCard[]>
  getGenres(): string[]
}
```

- [ ] **Step 3: Write the failing test for `parseValue`**

Create `lib/firestore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseValue, parseDoc } from './firestore'

describe('parseValue', () => {
  it('parses stringValue', () => {
    expect(parseValue({ stringValue: 'hello' })).toBe('hello')
  })

  it('parses integerValue as number', () => {
    expect(parseValue({ integerValue: '42' })).toBe(42)
  })

  it('parses doubleValue', () => {
    expect(parseValue({ doubleValue: 8.33 })).toBe(8.33)
  })

  it('parses timestampValue', () => {
    expect(parseValue({ timestampValue: '2026-06-01T00:00:00Z' })).toBe('2026-06-01T00:00:00Z')
  })

  it('parses arrayValue', () => {
    expect(parseValue({
      arrayValue: { values: [{ stringValue: 'Action' }, { stringValue: 'Fantasy' }] }
    })).toEqual(['Action', 'Fantasy'])
  })

  it('parses empty arrayValue', () => {
    expect(parseValue({ arrayValue: {} })).toEqual([])
  })

  it('parses mapValue', () => {
    expect(parseValue({
      mapValue: { fields: { name: { stringValue: 'test' } } }
    })).toEqual({ name: 'test' })
  })

  it('parses nullValue', () => {
    expect(parseValue({ nullValue: null })).toBeNull()
  })
})

describe('parseDoc', () => {
  it('extracts id from document name and parses fields', () => {
    const doc = {
      name: 'projects/p/databases/(default)/documents/KomikApp/abc123',
      fields: {
        name: { stringValue: 'One Piece' },
        views: { integerValue: '9999' },
      },
    }
    const result = parseDoc(doc)
    expect(result.id).toBe('abc123')
    expect(result.name).toBe('One Piece')
    expect(result.views).toBe(9999)
  })
})
```

- [ ] **Step 4: Run test — expect FAIL**

```bash
pnpm test
```

Expected: FAIL — `parseValue` and `parseDoc` are not defined yet.

- [ ] **Step 5: Create `lib/firestore.ts`**

```typescript
import { getConfig } from './config'

export type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }

export function parseValue(v: FirestoreValue): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(parseValue)
  if ('mapValue' in v) {
    const fields = v.mapValue.fields ?? {}
    return Object.fromEntries(Object.entries(fields).map(([k, val]) => [k, parseValue(val)]))
  }
  return null
}

export function parseDoc(doc: {
  name: string
  fields: Record<string, FirestoreValue>
}): Record<string, unknown> & { id: string } {
  const id = doc.name.split('/').at(-1)!
  const fields = Object.fromEntries(
    Object.entries(doc.fields).map(([k, v]) => [k, parseValue(v)])
  )
  return { id, ...fields }
}

type FirestoreResult = { document?: { name: string; fields: Record<string, FirestoreValue> } }

export async function runQuery(
  query: Record<string, unknown>,
  revalidate?: number
): Promise<(Record<string, unknown> & { id: string })[]> {
  const { KEIKOMIK_PROJECT_ID, KEIKOMIK_API_KEY } = getConfig()
  const url = `https://firestore.googleapis.com/v1/projects/${KEIKOMIK_PROJECT_ID}/databases/(default)/documents:runQuery?key=${KEIKOMIK_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query }),
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' }),
  })

  if (!res.ok) throw new Error(`Firestore error: ${res.status} ${await res.text()}`)

  const results: FirestoreResult[] = await res.json()
  return results.filter(r => r.document).map(r => parseDoc(r.document!))
}
```

- [ ] **Step 6: Run test — expect PASS**

```bash
pnpm test
```

Expected: All 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/ 
git commit -m "feat: types, config, Firestore REST wrapper with tests"
```

---

## Task 3: KeikomikProvider + Factory

**Files:**
- Create: `lib/providers/keikomik.ts`
- Create: `lib/providers/index.ts`
- Create: `lib/providers/keikomik.test.ts`

**Interfaces:**
- Consumes: `runQuery` from `lib/firestore.ts`, all types from `lib/providers/types.ts`
- Produces: `getProvider(): MangaProvider` (singleton factory)

- [ ] **Step 1: Write failing tests**

Create `lib/providers/keikomik.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as firestore from '../firestore'

vi.mock('../firestore', () => ({
  runQuery: vi.fn(),
}))

// Import AFTER mock setup
const { KeikomikProvider } = await import('./keikomik')

const SAMPLE_DOC = {
  id: 'abc',
  slug: 'one-piece',
  name: 'One Piece',
  name2: 'ワンピース',
  nameLow: 'one piece',
  type: 'Manga',
  image: 'https://kreisnow.web.id/cover.webp',
  description: 'Pirates story.',
  genre: ['Action', 'Adventure'],
  demographic: ['Shounen'],
  themes: ['Pirates'],
  author: 'Eiichiro Oda',
  artist: 'Eiichiro Oda',
  rate: 9.1,
  rilis: '1997',
  status: 'Ongoing',
  sub: 'bi',
  views: 100000,
  UpdateAt: '2026-06-01T00:00:00Z',
  CreateAt: '2025-01-01T00:00:00Z',
  Komik: {
    '1': { img: ['https://kreisnow.web.id/1/1.jpg', 'https://kreisnow.web.id/1/2.jpg'], UpdateAt: '2025-01-01T00:00:00Z', ket: '' },
    '2': { img: ['https://kreisnow.web.id/2/1.jpg'], UpdateAt: '2026-06-01T00:00:00Z', ket: '' },
    '3': { img: ['', ''], UpdateAt: '2026-06-01T00:00:00Z', ket: '' }, // invalid — img[0] is empty
  },
}

beforeEach(() => vi.clearAllMocks())

describe('KeikomikProvider.getPopular', () => {
  it('returns manga cards ordered by views', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    const result = await provider.getPopular()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('one-piece')
    expect(result[0].latestChapter).toBe(2)  // chapter 3 is invalid (empty img[0])
  })

  it('excludes documents with status tutup', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([{ ...SAMPLE_DOC, status: 'tutup' }])
    const provider = new KeikomikProvider()
    const result = await provider.getPopular()
    expect(result).toHaveLength(0)
  })
})

describe('KeikomikProvider.getManga', () => {
  it('returns manga detail with chapters sorted descending', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    const result = await provider.getManga('one-piece')
    expect(result.slug).toBe('one-piece')
    expect(result.chapters).toHaveLength(2)      // chapter 3 excluded (empty img[0])
    expect(result.chapters[0].number).toBe(2)    // newest first
    expect(result.chapters[1].number).toBe(1)
  })

  it('throws if slug not found', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([])
    const provider = new KeikomikProvider()
    await expect(provider.getManga('not-found')).rejects.toThrow('not found')
  })
})

describe('KeikomikProvider.getChapter', () => {
  it('returns chapter detail with correct prev/next', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    const result = await provider.getChapter('one-piece', 1)
    expect(result.pages).toEqual(['https://kreisnow.web.id/1/1.jpg', 'https://kreisnow.web.id/1/2.jpg'])
    expect(result.prev).toBeNull()    // chapter 1 has no previous
    expect(result.next).toBe(2)
  })

  it('throws if chapter not found', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    await expect(provider.getChapter('one-piece', 99)).rejects.toThrow('Chapter 99 not found')
  })
})

describe('KeikomikProvider.getGenres', () => {
  it('returns static genre list', () => {
    const provider = new KeikomikProvider()
    const genres = provider.getGenres()
    expect(genres).toContain('Action')
    expect(genres).toContain('Romance')
    expect(genres.length).toBeGreaterThan(5)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test
```

Expected: FAIL — `KeikomikProvider` not defined.

- [ ] **Step 3: Create `lib/providers/keikomik.ts`**

```typescript
import { runQuery } from '../firestore'
import type { MangaCard, MangaDetail, ChapterDetail, ChapterMeta, PaginatedResult, MangaProvider } from './types'

const GENRES = [
  'Action', 'Fantasy', 'Adventure', 'Comedy', 'Sci-Fi',
  'Romance', 'Mystery', 'Horror', 'Slice of Life', 'Supernatural', 'Isekai',
]

type RawKomikChapter = { img: string[]; UpdateAt?: string; ket?: string }
type RawDoc = Record<string, unknown> & { id: string }

function validChapters(komik: Record<string, RawKomikChapter>): [number, RawKomikChapter][] {
  return Object.entries(komik)
    .filter(([, ch]) => Array.isArray(ch.img) && ch.img.length > 0 && ch.img[0] !== '')
    .map(([num, ch]) => [Number(num), ch] as [number, RawKomikChapter])
    .sort((a, b) => a[0] - b[0])
}

function parseMangaCard(doc: RawDoc): MangaCard {
  const komik = (doc.Komik ?? {}) as Record<string, RawKomikChapter>
  const chapters = validChapters(komik)
  const latestChapter = chapters.length > 0 ? chapters[chapters.length - 1][0] : null
  return {
    id: doc.id,
    slug: doc.slug as string,
    name: doc.name as string,
    type: (doc.type as string) ?? 'Manga',
    image: doc.image as string,
    latestChapter,
    updatedAt: (doc.UpdateAt as string) ?? '',
  }
}

function parseMangaDetail(doc: RawDoc): MangaDetail {
  const komik = (doc.Komik ?? {}) as Record<string, RawKomikChapter>
  const sorted = validChapters(komik)

  const chapters: ChapterMeta[] = sorted
    .map(([num, ch]) => ({
      number: num,
      updatedAt: ch.UpdateAt ?? '',
      note: ch.ket ?? '',
    }))
    .reverse() // newest first

  const card = parseMangaCard(doc)
  return {
    ...card,
    name2: (doc.name2 as string) ?? '',
    description: (doc.description as string) ?? '',
    genre: (doc.genre as string[]) ?? [],
    demographic: (doc.demographic as string[]) ?? [],
    themes: (doc.themes as string[]) ?? [],
    author: (doc.author as string) ?? '',
    artist: (doc.artist as string) ?? '',
    rate: (doc.rate as number) ?? 0,
    status: (doc.status as string) ?? 'Ongoing',
    rilis: (doc.rilis as string) ?? '',
    chapters,
  }
}

export class KeikomikProvider implements MangaProvider {
  getGenres(): string[] {
    return GENRES
  }

  async getPopular(): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'views' }, direction: 'DESCENDING' }],
      limit: 8,
    }, 3600)
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }

  async getLatestUpdate(): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'UpdateAt' }, direction: 'DESCENDING' }],
      limit: 12,
    }, 3600)
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }

  async getNewArrivals(): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'CreateAt' }, direction: 'DESCENDING' }],
      limit: 10,
    }, 3600)
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }

  async getList(opts: {
    genre?: string
    sort?: 'update' | 'create'
    after?: string
  }): Promise<PaginatedResult<MangaCard>> {
    const orderField = opts.sort === 'create' ? 'CreateAt' : 'UpdateAt'

    // Genre filter: no orderBy (avoids composite index requirement)
    if (opts.genre) {
      const docs = await runQuery({
        from: [{ collectionId: 'KomikApp' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'genre' },
            op: 'ARRAY_CONTAINS',
            value: { stringValue: opts.genre },
          },
        },
        limit: 100,
      }, 3600)
      const data = docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
      return { data, nextCursor: null, hasMore: false }
    }

    const query: Record<string, unknown> = {
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }],
      limit: 36,
    }

    if (opts.after) {
      query.startAt = {
        values: [{ timestampValue: opts.after }],
        before: false, // startAfter semantics
      }
    }

    const docs = await runQuery(query, 3600)
    const filtered = docs.filter(d => d.status !== 'tutup')
    const data = filtered.map(parseMangaCard)
    const hasMore = docs.length === 36
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].updatedAt : null

    return { data, nextCursor, hasMore }
  }

  async getManga(slug: string): Promise<MangaDetail> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'slug' },
          op: 'EQUAL',
          value: { stringValue: slug },
        },
      },
      limit: 1,
    }, 1800)

    if (!docs.length) throw new Error(`Manga not found: ${slug}`)
    return parseMangaDetail(docs[0])
  }

  async getChapter(slug: string, chapter: number): Promise<ChapterDetail> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'slug' },
          op: 'EQUAL',
          value: { stringValue: slug },
        },
      },
      limit: 1,
    }, 86400)

    if (!docs.length) throw new Error(`Manga not found: ${slug}`)
    const doc = docs[0]
    const komik = (doc.Komik ?? {}) as Record<string, RawKomikChapter>
    const chapterData = komik[String(chapter)]
    if (!chapterData || !chapterData.img?.length) {
      throw new Error(`Chapter ${chapter} not found in ${slug}`)
    }

    const allNums = validChapters(komik).map(([n]) => n)
    const idx = allNums.indexOf(chapter)
    const prev = idx > 0 ? allNums[idx - 1] : null
    const next = idx < allNums.length - 1 ? allNums[idx + 1] : null

    return {
      mangaSlug: slug,
      mangaName: doc.name as string,
      mangaImage: doc.image as string,
      chapter,
      pages: chapterData.img.filter(Boolean),
      prev,
      next,
    }
  }

  async search(query: string): Promise<MangaCard[]> {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'nameLow' }, direction: 'ASCENDING' }],
      startAt: { values: [{ stringValue: q }], before: true },
      endAt: { values: [{ stringValue: q + '' }], before: false },
      limit: 8,
    })
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }
}
```

- [ ] **Step 4: Create `lib/providers/index.ts`**

```typescript
import type { MangaProvider } from './types'
import { KeikomikProvider } from './keikomik'
import { getConfig } from '../config'

let instance: MangaProvider | null = null

export function getProvider(): MangaProvider {
  if (instance) return instance
  const { MANGA_PROVIDER } = getConfig()
  switch (MANGA_PROVIDER) {
    case 'keikomik':
    default:
      instance = new KeikomikProvider()
  }
  return instance
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/
git commit -m "feat: KeikomikProvider — all 7 provider methods with tests"
```

---

## Task 4: MangaCard Component

**Files:**
- Create: `components/MangaCard.tsx`

**Interfaces:**
- Consumes: `MangaCard` type from `lib/providers/types.ts`
- Produces: `<MangaCard manga={MangaCard} />` — used on homepage, list, search, bookmark, history pages

- [ ] **Step 1: Create `components/MangaCard.tsx`**

```tsx
import Image from 'next/image'
import Link from 'next/link'
import type { MangaCard as MangaCardType } from '@/lib/providers/types'

const TYPE_BADGE: Record<string, string> = {
  Manga: 'bg-accent text-white',
  Manhwa: 'bg-accent-2 text-white',
  Manhua: 'bg-gold text-black',
}

export default function MangaCard({ manga }: { manga: MangaCardType }) {
  const badgeClass = TYPE_BADGE[manga.type] ?? 'bg-muted text-white'

  return (
    <Link href={`/manga/${manga.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-lg bg-surface aspect-[2/3]">
        <Image
          src={manga.image}
          alt={manga.name}
          fill
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 160px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized
        />
        <span className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeClass}`}>
          {manga.type}
        </span>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <h3 className="mt-1.5 text-xs font-semibold text-fg line-clamp-2 leading-tight">{manga.name}</h3>
      {manga.latestChapter !== null && (
        <p className="text-[10px] text-muted mt-0.5">Ch. {manga.latestChapter}</p>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/MangaCard.tsx
git commit -m "feat: MangaCard component with type badge and hover effect"
```

---

## Task 5: Homepage

**Files:**
- Create: `app/page.tsx`
- Create: `components/HeroCarousel.tsx`

**Interfaces:**
- Consumes: `getProvider()`, `MangaCard` type, `<MangaCard />` component
- Produces: `/` — hero carousel + latest update row + new arrivals grid

- [ ] **Step 1: Create `components/HeroCarousel.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { MangaCard } from '@/lib/providers/types'

const TYPE_BADGE: Record<string, string> = {
  Manga: 'bg-accent',
  Manhwa: 'bg-accent-2',
  Manhua: 'bg-gold',
}

export default function HeroCarousel({ items }: { items: MangaCard[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setCurrent(c => (c + 1) % items.length), 4000)
    return () => clearInterval(id)
  }, [items.length])

  if (!items.length) return null

  return (
    <div className="relative rounded-xl overflow-hidden h-72 md:h-96 mb-10 bg-surface">
      {items.map((manga, i) => (
        <Link
          key={manga.id}
          href={`/manga/${manga.slug}`}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Image
            src={manga.image}
            alt={manga.name}
            fill
            sizes="100vw"
            className="object-cover object-top"
            unoptimized
            priority={i === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-6">
            <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${TYPE_BADGE[manga.type] ?? 'bg-muted'}`}>
              {manga.type}
            </span>
            <h2 className="text-white text-xl md:text-2xl font-bold mt-2 line-clamp-2">{manga.name}</h2>
            {manga.latestChapter !== null && (
              <p className="text-white/70 text-sm mt-1">Chapter {manga.latestChapter}</p>
            )}
          </div>
        </Link>
      ))}

      {/* Dot indicators */}
      <div className="absolute bottom-4 right-4 flex gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); setCurrent(i) }}
            className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/page.tsx`**

```tsx
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import HeroCarousel from '@/components/HeroCarousel'

export const revalidate = 3600

export default async function HomePage() {
  const provider = getProvider()
  const [popular, latestUpdate, newArrivals] = await Promise.all([
    provider.getPopular(),
    provider.getLatestUpdate(),
    provider.getNewArrivals(),
  ])

  return (
    <div>
      <HeroCarousel items={popular} />

      <section className="mb-10">
        <h2 className="text-lg font-bold text-fg mb-4">Latest Update</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {latestUpdate.map(manga => (
            <div key={manga.id} className="flex-shrink-0 w-32 md:w-36">
              <MangaCard manga={manga} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-fg mb-4">New Arrivals</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {newArrivals.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Add `scrollbar-hide` utility to `globals.css`**

Append to `app/globals.css`:
```css
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 4: Test in browser**

```bash
pnpm dev
```

Visit http://localhost:3000. Expected:
- Hero carousel shows 8 popular manga with cover images
- Auto-advances every 4 seconds
- "Latest Update" shows horizontal scroll row of 12 cards
- "New Arrivals" shows 10-card grid

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/HeroCarousel.tsx app/globals.css
git commit -m "feat: homepage — hero carousel, latest update, new arrivals"
```

---

## Task 6: List/Browse Page

**Files:**
- Create: `app/list/page.tsx`
- Create: `components/GenreFilter.tsx`

**Interfaces:**
- Consumes: `getProvider()`, `MangaCard` component, `PaginatedResult<MangaCard>`
- Produces: `/list?genre=Action&sort=update&after={cursor}` — filterable paginated grid

- [ ] **Step 1: Create `components/GenreFilter.tsx`**

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const SORTS = [
  { id: 'update', label: 'Latest Update' },
  { id: 'create', label: 'New Arrivals' },
]

export default function GenreFilter({ genres, currentGenre, currentSort }: {
  genres: string[]
  currentGenre?: string
  currentSort?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('after') // reset pagination on filter change
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null) params.delete(k)
      else params.set(k, v)
    })
    return params.toString()
  }, [searchParams])

  return (
    <div className="mb-6 space-y-3">
      {/* Sort toggles */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`${pathname}?${createQuery({ sort: null, genre: null })}`)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!currentGenre && !currentSort ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}
        >
          All
        </button>
        {SORTS.map(s => (
          <button
            key={s.id}
            onClick={() => router.push(`${pathname}?${createQuery({ sort: s.id, genre: null })}`)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${currentSort === s.id ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-fg'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Genre pills */}
      <div className="flex flex-wrap gap-2">
        {genres.map(g => (
          <button
            key={g}
            onClick={() => router.push(`${pathname}?${createQuery({ genre: currentGenre === g ? null : g, sort: null })}`)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              currentGenre === g
                ? 'bg-accent border-accent text-white'
                : 'border-border text-muted hover:border-accent hover:text-accent'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/list/page.tsx`**

```tsx
import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import GenreFilter from '@/components/GenreFilter'
import Link from 'next/link'

export const revalidate = 3600

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; sort?: string; after?: string }>
}) {
  const { genre, sort, after } = await searchParams
  const provider = getProvider()
  const genres = provider.getGenres()

  const { data, nextCursor, hasMore } = await provider.getList({
    genre,
    sort: sort === 'create' ? 'create' : 'update',
    after,
  })

  const nextParams = new URLSearchParams()
  if (genre) nextParams.set('genre', genre)
  if (sort) nextParams.set('sort', sort)
  if (nextCursor) nextParams.set('after', nextCursor)

  return (
    <div>
      <h1 className="text-xl font-bold text-fg mb-4">Browse</h1>
      <Suspense>
        <GenreFilter
          genres={genres}
          currentGenre={genre}
          currentSort={sort}
        />
      </Suspense>

      {data.length === 0 ? (
        <p className="text-muted text-center py-20">No manga found.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {data.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}

      {hasMore && nextCursor && !genre && (
        <div className="flex justify-center mt-8">
          <Link
            href={`/list?${nextParams.toString()}`}
            className="px-6 py-2 rounded-full bg-surface-2 text-muted hover:bg-accent hover:text-white transition-colors text-sm font-medium"
          >
            Load More
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

Visit http://localhost:3000/list. Expected:
- Genre pills and sort buttons appear
- Clicking a genre reloads page with filtered results
- "Load More" appears when there are 36 results
- Genre filter shows up to 100 results with no pagination

- [ ] **Step 4: Commit**

```bash
git add app/list/ components/GenreFilter.tsx
git commit -m "feat: list/browse page with genre filter and cursor pagination"
```

---

## Task 7: Manga Detail Page

**Files:**
- Create: `app/manga/[slug]/page.tsx`
- Create: `components/BookmarkButton.tsx`

**Interfaces:**
- Consumes: `getProvider()`, `MangaDetail` type
- Produces: `/manga/[slug]` — sticky sidebar layout + chapter list + bookmark

- [ ] **Step 1: Create `components/BookmarkButton.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { MangaCard } from '@/lib/providers/types'

type BookmarkEntry = Pick<MangaCard, 'slug' | 'name' | 'image' | 'type' | 'latestChapter'>

const KEY = 'mikomi_bookmarks'

function load(): BookmarkEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function save(entries: BookmarkEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export default function BookmarkButton({ manga }: { manga: BookmarkEntry }) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    const entries = load()
    setBookmarked(entries.some(e => e.slug === manga.slug))
  }, [manga.slug])

  function toggle() {
    const entries = load()
    const isBookmarked = entries.some(e => e.slug === manga.slug)
    const next = isBookmarked
      ? entries.filter(e => e.slug !== manga.slug)
      : [manga, ...entries]
    save(next)
    setBookmarked(!isBookmarked)
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        bookmarked
          ? 'bg-accent text-white'
          : 'bg-surface-2 text-muted hover:bg-accent hover:text-white'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
      {bookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  )
}
```

- [ ] **Step 2: Create `app/manga/[slug]/page.tsx`**

```tsx
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProvider } from '@/lib/providers'
import BookmarkButton from '@/components/BookmarkButton'

export const revalidate = 1800

export default async function MangaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const provider = getProvider()

  let manga
  try {
    manga = await provider.getManga(slug)
  } catch {
    notFound()
  }

  const STATUS_COLOR: Record<string, string> = {
    Ongoing: 'text-green-400',
    Completed: 'text-blue-400',
    Hiatus: 'text-yellow-400',
  }

  return (
    <div className="md:flex gap-8">
      {/* Sidebar */}
      <aside className="md:w-52 flex-shrink-0 md:sticky md:top-20 md:self-start">
        <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-4">
          <Image
            src={manga.image}
            alt={manga.name}
            fill
            sizes="208px"
            className="object-cover"
            unoptimized
            priority
          />
        </div>
        <BookmarkButton manga={manga} />

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted text-xs">Status</dt>
            <dd className={`font-medium ${STATUS_COLOR[manga.status] ?? 'text-fg'}`}>{manga.status}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Type</dt>
            <dd className="text-fg">{manga.type}</dd>
          </div>
          {manga.author && (
            <div>
              <dt className="text-muted text-xs">Author</dt>
              <dd className="text-fg">{manga.author}</dd>
            </div>
          )}
          {manga.rilis && (
            <div>
              <dt className="text-muted text-xs">Released</dt>
              <dd className="text-fg">{manga.rilis}</dd>
            </div>
          )}
          {manga.rate > 0 && (
            <div>
              <dt className="text-muted text-xs">Rating</dt>
              <dd className="text-fg">⭐ {manga.rate.toFixed(1)}</dd>
            </div>
          )}
        </dl>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 mt-6 md:mt-0">
        <h1 className="text-2xl font-bold text-fg">{manga.name}</h1>
        {manga.name2 && <p className="text-muted text-sm mt-1">{manga.name2}</p>}

        {/* Genres */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {manga.genre.map(g => (
            <Link
              key={g}
              href={`/list?genre=${encodeURIComponent(g)}`}
              className="px-2 py-0.5 rounded text-xs bg-surface-2 text-muted hover:text-accent transition-colors"
            >
              {g}
            </Link>
          ))}
        </div>

        {/* Description */}
        {manga.description && (
          <p className="text-muted text-sm leading-relaxed mt-4 line-clamp-4">{manga.description}</p>
        )}

        {/* Start reading */}
        {manga.chapters.length > 0 && (
          <div className="flex gap-3 mt-6">
            <Link
              href={`/chapter/${manga.slug}/${manga.chapters[manga.chapters.length - 1].number}`}
              className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 transition-colors"
            >
              Start Reading
            </Link>
            <Link
              href={`/chapter/${manga.slug}/${manga.chapters[0].number}`}
              className="px-5 py-2 rounded-lg bg-surface-2 text-fg text-sm font-medium hover:bg-accent hover:text-white transition-colors"
            >
              Latest Chapter
            </Link>
          </div>
        )}

        {/* Chapter list */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-fg mb-3">{manga.chapters.length} Chapters</h2>
          <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {manga.chapters.map(ch => (
              <Link
                key={ch.number}
                href={`/chapter/${manga.slug}/${ch.number}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface hover:bg-surface-2 transition-colors group"
              >
                <span className="text-sm text-fg group-hover:text-accent transition-colors">
                  Chapter {ch.number}
                </span>
                <span className="text-xs text-muted">
                  {ch.updatedAt ? new Date(ch.updatedAt).toLocaleDateString('id-ID') : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

```bash
pnpm dev
```

Visit http://localhost:3000/manga/one-piece (or any real slug from the homepage). Expected:
- Cover image in sticky sidebar on desktop
- Chapter list scrollable up to 480px height
- Bookmark button toggles and persists on refresh
- Genre tags link to `/list?genre=...`
- "Start Reading" links to first chapter, "Latest Chapter" to newest

- [ ] **Step 4: Commit**

```bash
git add app/manga/ components/BookmarkButton.tsx
git commit -m "feat: manga detail page with sticky sidebar, chapter list, bookmark"
```

---

## Task 8: Chapter Reader

**Files:**
- Create: `app/chapter/[slug]/[chapter]/page.tsx`
- Create: `components/ChapterReader.tsx`
- Create: `components/HistoryTracker.tsx`

**Interfaces:**
- Consumes: `getProvider()`, `ChapterDetail` type
- Produces: `/chapter/[slug]/[chapter]` — long-strip or single-page image reader

- [ ] **Step 1: Create `components/HistoryTracker.tsx`**

```tsx
'use client'

import { useEffect } from 'react'

type HistoryEntry = {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
  timestamp: number
}

const KEY = 'mikomi_history'

export default function HistoryTracker({
  slug,
  chapter,
  mangaName,
  mangaImage,
}: {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
}) {
  useEffect(() => {
    try {
      const existing: HistoryEntry[] = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      const filtered = existing.filter(e => !(e.slug === slug && e.chapter === chapter))
      const updated: HistoryEntry[] = [
        { slug, chapter, mangaName, mangaImage, timestamp: Date.now() },
        ...filtered,
      ].slice(0, 100)
      localStorage.setItem(KEY, JSON.stringify(updated))
    } catch { /* ignore storage errors */ }
  }, [slug, chapter, mangaName, mangaImage])

  return null
}
```

- [ ] **Step 2: Create `components/ChapterReader.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const MODE_KEY = 'mikomi_reading_mode'

export default function ChapterReader({
  pages,
  slug,
  chapter,
  prev,
  next,
  mangaName,
}: {
  pages: string[]
  slug: string
  chapter: number
  prev: number | null
  next: number | null
  mangaName: string
}) {
  const [mode, setMode] = useState<'strip' | 'single'>('strip')
  const [pageIndex, setPageIndex] = useState(0)

  // Load persisted mode
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY)
      if (saved === 'single' || saved === 'strip') setMode(saved)
    } catch { /* ignore */ }
  }, [])

  function toggleMode() {
    const next = mode === 'strip' ? 'single' : 'strip'
    setMode(next)
    setPageIndex(0)
    try { localStorage.setItem(MODE_KEY, next) } catch { /* ignore */ }
  }

  const goNext = useCallback(() => {
    if (mode === 'single') {
      if (pageIndex < pages.length - 1) setPageIndex(p => p + 1)
    }
  }, [mode, pageIndex, pages.length])

  const goPrev = useCallback(() => {
    if (mode === 'single') {
      if (pageIndex > 0) setPageIndex(p => p - 1)
    }
  }, [mode, pageIndex])

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goNext, goPrev])

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/manga/${slug}`} className="text-sm text-muted hover:text-fg transition-colors flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          {mangaName}
        </Link>
        <span className="text-sm text-muted font-medium">Chapter {chapter}</span>
        <button
          onClick={toggleMode}
          className="text-xs px-3 py-1 rounded-full bg-surface-2 text-muted hover:text-fg transition-colors"
        >
          {mode === 'strip' ? '📄 Single' : '📜 Strip'}
        </button>
      </div>

      {/* Reader */}
      {mode === 'strip' ? (
        <div className="flex flex-col items-center gap-1">
          {pages.map((src, i) => (
            <div key={i} className="w-full max-w-2xl">
              <Image
                src={src}
                alt={`Page ${i + 1}`}
                width={800}
                height={1200}
                className="w-full h-auto"
                unoptimized
                loading={i < 3 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl relative">
            <Image
              key={pageIndex}
              src={pages[pageIndex]}
              alt={`Page ${pageIndex + 1}`}
              width={800}
              height={1200}
              className="w-full h-auto"
              unoptimized
              priority
            />
            {/* Tap zones */}
            <button
              onClick={goPrev}
              className="absolute left-0 inset-y-0 w-1/3 opacity-0"
              aria-label="Previous page"
            />
            <button
              onClick={goNext}
              className="absolute right-0 inset-y-0 w-1/3 opacity-0"
              aria-label="Next page"
            />
          </div>
          <p className="text-muted text-sm mt-3">{pageIndex + 1} / {pages.length}</p>
        </div>
      )}

      {/* Floating bottom nav */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface border border-border rounded-full px-5 py-2.5 shadow-xl">
        {prev !== null ? (
          <Link href={`/chapter/${slug}/${prev}`} className="text-sm text-muted hover:text-fg transition-colors">
            ← Ch. {prev}
          </Link>
        ) : (
          <span className="text-sm text-border">← First</span>
        )}

        <span className="text-xs text-muted px-2 border-x border-border">
          {mode === 'single' ? `${pageIndex + 1}/${pages.length}` : `${pages.length}p`}
        </span>

        {next !== null ? (
          <Link href={`/chapter/${slug}/${next}`} className="text-sm text-muted hover:text-fg transition-colors">
            Ch. {next} →
          </Link>
        ) : (
          <span className="text-sm text-border">Last →</span>
        )}
      </div>

      <div className="h-20" /> {/* Spacer for floating bar */}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/chapter/[slug]/[chapter]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { getProvider } from '@/lib/providers'
import ChapterReader from '@/components/ChapterReader'
import HistoryTracker from '@/components/HistoryTracker'

export const revalidate = 86400

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}) {
  const { slug, chapter: chapterStr } = await params
  const chapter = Number(chapterStr)

  if (isNaN(chapter)) notFound()

  const provider = getProvider()
  let data
  try {
    data = await provider.getChapter(slug, chapter)
  } catch {
    notFound()
  }

  return (
    <div>
      <HistoryTracker
        slug={slug}
        chapter={chapter}
        mangaName={data.mangaName}
        mangaImage={data.mangaImage}
      />
      <ChapterReader
        pages={data.pages}
        slug={slug}
        chapter={chapter}
        prev={data.prev}
        next={data.next}
        mangaName={data.mangaName}
      />
    </div>
  )
}
```

- [ ] **Step 4: Test in browser**

Visit a chapter URL e.g. `/chapter/from-goblin-to-goblin-god/63`. Expected:
- Long-strip mode: all pages stack vertically
- Toggle button switches to single-page mode
- Arrow keys navigate pages in single-page mode
- Tap left/right side of image to navigate pages
- Floating bottom bar shows prev/next chapter links
- History entry written to localStorage on page load

- [ ] **Step 5: Commit**

```bash
git add app/chapter/ components/ChapterReader.tsx components/HistoryTracker.tsx
git commit -m "feat: chapter reader — long-strip/single-page modes, keyboard nav, history tracking"
```

---

## Task 9: Search Page

**Files:**
- Create: `app/search/page.tsx`
- Create: `components/SearchBar.tsx`

**Interfaces:**
- Consumes: `getProvider()`, `MangaCard` component
- Produces: `/search?q=...` — instant search with 500ms debounce

- [ ] **Step 1: Create `components/SearchBar.tsx`**

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) params.set('q', value.trim())
      else params.delete('q')
      router.replace(`${pathname}?${params.toString()}`)
    }, 500)
  }

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder="Search manga, manhwa, manhua..."
        className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface border border-border text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
        autoFocus
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/search/page.tsx`**

```tsx
import { Suspense } from 'react'
import { getProvider } from '@/lib/providers'
import MangaCard from '@/components/MangaCard'
import SearchBar from '@/components/SearchBar'

export const dynamic = 'force-dynamic'

async function SearchResults({ query }: { query: string }) {
  if (!query.trim()) {
    return <p className="text-muted text-center py-20 text-sm">Start typing to search...</p>
  }
  const provider = getProvider()
  const results = await provider.search(query)
  if (!results.length) {
    return <p className="text-muted text-center py-20 text-sm">No results for "{query}"</p>
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-6">
      {results.map(manga => (
        <MangaCard key={manga.id} manga={manga} />
      ))}
    </div>
  )
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams

  return (
    <div>
      <h1 className="text-xl font-bold text-fg mb-4">Search</h1>
      <Suspense>
        <SearchBar defaultValue={q} />
      </Suspense>
      <Suspense fallback={<p className="text-muted text-center py-20 text-sm">Searching...</p>}>
        <SearchResults query={q} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

Visit http://localhost:3000/search. Expected:
- Input is focused on load
- Typing "one" after 500ms debounce pushes URL to `/search?q=one`
- Results appear below input
- Clearing input shows "Start typing to search..."

- [ ] **Step 4: Commit**

```bash
git add app/search/ components/SearchBar.tsx
git commit -m "feat: search page — debounced SearchBar, force-dynamic SSR results"
```

---

## Task 10: Bookmark + History Pages

**Files:**
- Create: `app/bookmark/page.tsx`
- Create: `app/history/page.tsx`

**Interfaces:**
- Consumes: `MangaCard` component
- Produces: `/bookmark` — localStorage grid; `/history` — localStorage list

- [ ] **Step 1: Create `app/bookmark/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import MangaCard from '@/components/MangaCard'
import type { MangaCard as MangaCardType } from '@/lib/providers/types'

const KEY = 'mikomi_bookmarks'

export default function BookmarkPage() {
  const [bookmarks, setBookmarks] = useState<MangaCardType[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      setBookmarks(Array.isArray(data) ? data : [])
    } catch { setBookmarks([]) }
    setLoaded(true)
  }, [])

  function clearAll() {
    localStorage.removeItem(KEY)
    setBookmarks([])
  }

  if (!loaded) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">Bookmarks</h1>
        {bookmarks.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-muted hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {bookmarks.length === 0 ? (
        <p className="text-muted text-center py-20 text-sm">No bookmarks yet. Start bookmarking manga!</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {bookmarks.map(manga => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/history/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type HistoryEntry = {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
  timestamp: number
}

const KEY = 'mikomi_history'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      setHistory(Array.isArray(data) ? data : [])
    } catch { setHistory([]) }
    setLoaded(true)
  }, [])

  function clearAll() {
    localStorage.removeItem(KEY)
    setHistory([])
  }

  if (!loaded) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">Reading History</h1>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-muted hover:text-red-400 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-muted text-center py-20 text-sm">No reading history yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry, i) => (
            <Link
              key={i}
              href={`/chapter/${entry.slug}/${entry.chapter}`}
              className="flex items-center gap-4 p-3 rounded-xl bg-surface hover:bg-surface-2 transition-colors group"
            >
              <div className="relative w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                <Image
                  src={entry.mangaImage}
                  alt={entry.mangaName}
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg group-hover:text-accent transition-colors truncate">
                  {entry.mangaName}
                </p>
                <p className="text-xs text-muted mt-0.5">Chapter {entry.chapter}</p>
              </div>
              <span className="text-xs text-muted flex-shrink-0">{relativeTime(entry.timestamp)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Test in browser**

Visit http://localhost:3000/chapter/[any-slug]/[chapter] to write history, then:

- Visit http://localhost:3000/history — chapter appears in list
- Visit http://localhost:3000/manga/[slug] and bookmark it
- Visit http://localhost:3000/bookmark — manga appears
- Clear All on both pages removes all entries

- [ ] **Step 4: Commit**

```bash
git add app/bookmark/ app/history/
git commit -m "feat: bookmark and history pages — localStorage-based client components"
```

---

## Task 11: Final Checks + Multi-Agent Review

**Files:**
- No new files — verification pass

- [ ] **Step 1: TypeScript full check**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors. Fix any before continuing.

- [ ] **Step 2: Full test suite**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 3: Run dev and manually verify every page**

```bash
pnpm dev
```

Visit and verify:
- [ ] `/` — carousel autoplay, "Latest Update" scroll, "New Arrivals" grid
- [ ] `/list` — genre pills filter, sort toggles, "Load More" pagination
- [ ] `/manga/[real-slug]` — cover, metadata, chapter list, bookmark toggle
- [ ] `/chapter/[real-slug]/[chapter]` — images load, prev/next nav, mode toggle, keyboard arrows, floating bar
- [ ] `/search?q=one` — results appear, empty state on no results
- [ ] `/bookmark` — bookmarked manga appear, clear works
- [ ] `/history` — visited chapters appear, clear works

- [ ] **Step 4: Dispatch UI/UX Agent**

Dispatch a subagent with this prompt:

> You are a UI/UX reviewer. The project is a manga reading site at `/Users/marshpotao/Projects/mikomi`. Run `pnpm dev` and visually audit every page listed in the plan:
> - `/` (homepage)
> - `/list` (browse)
> - `/manga/[use a real slug from homepage]`
> - `/chapter/[slug]/[chapter]`
> - `/search`
> - `/bookmark`
> - `/history`
>
> For each page, check:
> 1. Color contrast — text must be readable against backgrounds (WCAG AA: 4.5:1 for normal text)
> 2. Spacing — no cramped elements, consistent padding
> 3. Hover states — buttons and links have visible hover feedback
> 4. Mobile layout at 375px width — nothing overflows, grids collapse correctly
> 5. Type badges appear on manga cards with correct colors (purple=Manga, pink=Manhwa, gold=Manhua)
> 6. Hero carousel advances automatically
> 7. Chapter reader floating bar is visible and not obscuring content
>
> Report: punch list of issues found (file:line if fixable in code), or "LGTM" per page.

- [ ] **Step 5: Dispatch Developer Agent**

Dispatch a subagent with this prompt:

> You are a code reviewer for a Next.js 16 project at `/Users/marshpotao/Projects/mikomi`. Review:
> 1. `lib/providers/keikomik.ts` — verify all 7 MangaProvider methods are implemented correctly, types match `lib/providers/types.ts`, no `any` types
> 2. `lib/firestore.ts` — verify `runQuery` passes `revalidate`/`cache` correctly via fetch options, `parseValue` handles all Firestore value types
> 3. Every file in `app/` — verify `params` and `searchParams` are awaited before use, no self-fetching own API routes, `force-dynamic` only on `/search`
> 4. `app/globals.css` — verify theme tokens are in `@theme {}` not in `tailwind.config.ts`
>
> Report: any violations found with file paths and line numbers, or "LGTM" per file.

- [ ] **Step 6: Dispatch QA Agent**

Dispatch a subagent with this prompt:

> You are a QA engineer for a manga reading site at `/Users/marshpotao/Projects/mikomi`. Run `pnpm dev` and test every feature:
>
> **Data features:**
> - Homepage loads 3 sections with real manga data from Firestore
> - List page shows manga grid
> - Genre filter "Action" returns only Action manga
> - Sort "New Arrivals" shows different order than "Latest Update"
> - Manga detail page shows title, cover, genre tags, chapter list
> - Chapter reader loads page images from `kreisnow.web.id`
> - Search "one" returns results within 1 second
>
> **Client features:**
> - Bookmarking a manga on detail page → appears on `/bookmark` after refresh
> - Removing bookmark → disappears from `/bookmark`
> - Reading a chapter → appears on `/history`
> - Clear All on history/bookmark → list empties
> - Reading mode toggle persists after navigating away and back
> - Keyboard arrow keys work in single-page mode
>
> Report: PASS/FAIL per feature with notes on failures.

- [ ] **Step 7: Fix any issues reported by agents**

Address all punch list items from UI/UX, Developer, and QA agents before proceeding to deploy.

- [ ] **Step 8: Build check**

```bash
pnpm build
```

Expected: Build completes with 0 errors. Fix any TypeScript or build errors.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "chore: pre-deploy verification — all agent reviews passed"
```

- [ ] **Step 10: Set Vercel env vars and deploy**

In Vercel dashboard, set:
```
MANGA_PROVIDER=keikomik
KEIKOMIK_PROJECT_ID=komikapp-677a0
KEIKOMIK_API_KEY=AIzaSyC6Jm-c0blt4T7JxBuMmoh5QNHaRQ0vgJI
NEXT_PUBLIC_BASE_URL=https://mikomi.vercel.app
```

Then push to GitHub and connect repo in Vercel, or:
```bash
pnpm dlx vercel --prod
```

- [ ] **Step 11: Smoke test production**

Visit the deployed URL and verify:
- [ ] Homepage loads with real data
- [ ] `/list` shows manga grid
- [ ] `/manga/[slug]` shows detail
- [ ] `/chapter/[slug]/[chapter]` loads images from `kreisnow.web.id`
- [ ] `/search?q=naruto` returns results
