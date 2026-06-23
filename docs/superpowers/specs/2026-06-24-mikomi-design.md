# Mikomi — Manga/Manhwa/Manhua Reader — Design Spec

> Date: 2026-06-24
> Status: Approved

---

## 1. Project Summary

**Mikomi** is a personal manga/manhwa/manhua reading site that clones the content of keikomik.web.id with a significantly better UI/UX. It is a standalone new repo deployed to Vercel.

**Source:** keikomik.web.id backs its data with a publicly-readable Firebase Firestore database (`komikapp-677a0`). Mikomi reads from the same database via the Firestore REST API — no HTML scraping needed.

**Images:** Served directly from `kreisnow.web.id` CDN. Tested: no hotlink protection, HTTP 200 from any referer. No image proxy required.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript |
| Styling | Tailwind v4 (tokens in `globals.css @theme {}`) |
| Data | Firestore REST API (no Firebase SDK) |
| Deploy | Vercel |
| Repo name | `mikomi` |

**Known Next.js 16 gotchas (apply from day one):**
- `params` and `searchParams` are Promises — always `await` them
- Tailwind v4: all theme tokens go in `globals.css @theme {}`, not `tailwind.config.ts`
- Pages call `getProvider()` directly — never self-fetch own API routes

---

## 3. Source Site Reverse Engineering

**Firebase project:** `komikapp-677a0`
**API key:** `AIzaSyC6Jm-c0blt4T7JxBuMmoh5QNHaRQ0vgJI` (client-exposed, standard Firebase web pattern)
**Firestore collection:** `KomikApp`
**Auth required:** None — anonymous reads verified via REST API

### 3.1 Document Structure

```
KomikApp/{id}:
  name: string           // display title (e.g. "One Piece")
  name2: string          // alternative title
  nameLow: string        // lowercase version for range-based search
  slug: string           // URL slug (e.g. "one-piece")
  type: string           // "Manga" | "Manhwa" | "Manhua"
  image: string          // cover URL on kreisnow.web.id
  description: string
  genre: string[]
  demographic: string[]
  themes: string[]
  author: string
  artist: string
  rate: number           // e.g. 8.33
  rilis: string          // release year e.g. "2024"
  status: string         // "Ongoing" | "Completed" | "Hiatus" | "tutup" (removed)
  sub: string            // "bi" = bahasa Indonesia
  views: number
  CreateAt: Timestamp
  UpdateAt: Timestamp
  Komik: {               // ALL chapters embedded (not a subcollection)
    "[chapterNumber]": {
      img: string[]      // ordered page image URLs
      UpdateAt: Timestamp
      ket: string        // chapter note
    }
  }
```

### 3.2 Firestore Queries

| Feature | Query |
|---|---|
| Popular | `orderBy("views", "desc"), limit(8)` |
| Latest update | `orderBy("UpdateAt", "desc"), limit(12)` |
| New arrivals | `orderBy("CreateAt", "desc"), limit(10)` |
| List (default) | `orderBy("UpdateAt", "desc"), startAfter(lastDoc), limit(36)` |
| List by genre | `where("genre", "array-contains", genre), limit(36)` |
| Search | `orderBy("nameLow"), startAt(q), endAt(q + ""), limit(8)` |
| Manga detail | `getDocument("KomikApp/{id}")` — fetch by slug via query |

### 3.3 Firestore REST Endpoint

```
POST https://firestore.googleapis.com/v1/projects/komikapp-677a0/databases/(default)/documents:runQuery
     ?key=AIzaSyC6Jm-c0blt4T7JxBuMmoh5QNHaRQ0vgJI
```

---

## 4. Architecture

### 4.1 Folder Structure

```
app/
  page.tsx                          → Homepage
  list/page.tsx                     → Browse/filter
  manga/[slug]/page.tsx             → Manga detail
  chapter/[slug]/[chapter]/page.tsx → Chapter reader
  search/page.tsx                   → Search (force-dynamic)
  bookmark/page.tsx                 → Bookmarks (client, localStorage)
  history/page.tsx                  → History (client, localStorage)

lib/
  providers/
    types.ts      → MangaProvider interface + all shared types
    keikomik.ts   → KeikomikProvider (Firestore REST)
    index.ts      → getProvider() factory, reads MANGA_PROVIDER env var
  firestore.ts    → shared fetch wrapper for Firestore REST API
  config.ts       → env vars, throws on missing

components/
  MangaCard.tsx
  ChapterReader.tsx
  HeroCarousel.tsx
  GenreFilter.tsx
  SearchBar.tsx
  BookmarkButton.tsx    → client component
  HistoryTracker.tsx    → client component
```

### 4.2 Provider Interface

```typescript
interface MangaProvider {
  getPopular(): Promise<MangaCard[]>
  getLatestUpdate(): Promise<MangaCard[]>
  getNewArrivals(): Promise<MangaCard[]>
  getList(opts: {
    genre?: string
    sort?: 'update' | 'create'
    after?: string        // Firestore pagination cursor
  }): Promise<PaginatedResult<MangaCard>>
  getManga(slug: string): Promise<MangaDetail>
  getChapter(slug: string, chapter: number): Promise<ChapterDetail>
  search(query: string): Promise<MangaCard[]>
  getGenres(): string[]   // static list, no async needed
}
```

### 4.3 Shared Types

```typescript
type MangaCard = {
  id: string
  slug: string
  name: string
  type: 'Manga' | 'Manhwa' | 'Manhua' | string
  image: string
  latestChapter: number | null
  updatedAt: string
}

type MangaDetail = MangaCard & {
  name2: string
  description: string
  genre: string[]
  demographic: string[]
  themes: string[]
  author: string
  artist: string
  rate: number
  status: 'Ongoing' | 'Completed' | 'Hiatus' | string
  rilis: string
  chapters: ChapterMeta[]
}

type ChapterMeta = {
  number: number
  updatedAt: string
  note: string
}

type ChapterDetail = {
  mangaSlug: string
  mangaName: string
  chapter: number
  pages: string[]
  prev: number | null
  next: number | null
}

type PaginatedResult<T> = {
  data: T[]
  nextCursor: string | null   // ISO timestamp string of last item's UpdateAt (used as startAfter value in Firestore REST)
  hasMore: boolean
}
```

### 4.4 Data Flow

```
Server Components call getProvider() → KeikomikProvider → Firestore REST → parsed typed data

Bookmark/History pages are client components → read/write localStorage only, no provider calls

Search page is force-dynamic (query string changes per request)
```

### 4.5 Provider Switching

```env
MANGA_PROVIDER=keikomik   # default, reads from komikapp-677a0
MANGA_PROVIDER=other      # future scraping-based provider
```

---

## 5. Page Specifications

### 5.1 Homepage (`/`)

- **Rendering:** Server Component, `revalidate: 3600`
- **Sections:**
  1. Hero carousel — top 8 popular manga (large cards with cover + title + type badge)
  2. "Latest Update" horizontal scroll row — 12 items sorted by UpdateAt
  3. "New Arrivals" grid — 10 items sorted by CreateAt
- **Data:** 3 parallel `getProvider()` calls

### 5.2 List/Browse (`/list`)

- **Rendering:** Server Component, `revalidate: 3600`
- **Features:**
  - Genre pills across the top (hardcoded list from source: Action, Fantasy, Adventure, Comedy, Sci-Fi, Romance, Mystery, Horror, Slice of Life, Supernatural, Isekai)
  - Sort toggle: "Latest Update" (default) | "New Arrivals"
  - Manga grid: 6 columns desktop, 3 mobile
  - "Load More" button → appends next 36 via query param pagination
- **URL params:** `?genre=Action&sort=update&after={cursor}`

### 5.3 Manga Detail (`/manga/[slug]`)

- **Rendering:** Server Component, `revalidate: 1800`
- **Layout:**
  - Desktop: sticky left sidebar (cover 200×280, metadata), main content area (description + chapter list)
  - Mobile: cover top, metadata below, chapter list at bottom
- **Chapter list:** Sorted descending (newest first), shows chapter number + relative date
- **Actions:** Bookmark button (client), "Start Reading" button → latest chapter

### 5.4 Chapter Reader (`/chapter/[slug]/[chapter]`)

- **Rendering:** Server Component, `revalidate: 86400`
- **Two reading modes (toggle persisted to localStorage):**
  - **Long-strip** (default): all pages stacked vertically, smooth scroll
  - **Single-page**: one page at a time, left/right swipe + keyboard arrows
- **Floating controls bar (bottom of screen):**
  - ← Prev chapter | Page X / Y indicator | Next chapter →
  - Reading mode toggle icon
- **On chapter load:** writes to history in localStorage (slug + chapter + timestamp)

### 5.5 Search (`/search`)

- **Rendering:** `force-dynamic`
- **Behavior:** `SearchBar` is a client component. On input change (500ms debounce), it calls `router.replace('/search?q=...')`. The `force-dynamic` server page reads `searchParams.q` and calls `provider.search()` server-side on each navigation.
- **Results:** Same MangaCard grid, max 8 results

### 5.6 Bookmark (`/bookmark`)

- **Rendering:** Client Component (localStorage only)
- **Content:** Grid of bookmarked manga cards (same card as list page)
- **Actions:** Remove individual bookmark, clear all

### 5.7 History (`/history`)

- **Rendering:** Client Component (localStorage only)
- **Content:** List of recently read chapters (manga cover + name + "Chapter X" + relative time)
- **Actions:** Clear all history

---

## 6. UI/UX Design

### 6.1 Color Palette

```css
@theme {
  --color-bg:        #0d0d12;
  --color-surface:   #13131a;
  --color-surface-2: #1c1c26;
  --color-accent:    #7c6aff;   /* purple — primary */
  --color-accent-2:  #e040a0;   /* pink — manhwa/manhua */
  --color-muted:     #6b7280;
  --color-border:    #232330;
  --color-fg:        #f0f0f8;
}
```

### 6.2 Type Badges

| Type | Color |
|---|---|
| Manga | Purple (`accent`) |
| Manhwa | Pink (`accent-2`) |
| Manhua | Gold (`#f59e0b`) |

### 6.3 Key UX Improvements over keikomik

| keikomik | Mikomi |
|---|---|
| Client-side only → "Loading..." everywhere | SSR → instant content |
| Plain black background | Deep navy with card surfaces |
| No reading mode options | Long-strip + single-page toggle |
| No page progress | "Page X / Y" floating indicator |
| Raw `<select>` genre filter | Pill tag grid |
| No keyboard nav | Arrow keys for single-page mode |
| No type color coding | Colored type badges |
| Homepage = two loading divs | Hero carousel + two content rows |

---

## 7. Multi-Agent Review Plan

After implementation, three agents run in sequence:

1. **UI/UX Agent** — checks visual consistency, spacing, color contrast (WCAG AA), mobile responsiveness on every page. Reports issues as a punch list.

2. **Developer Agent** — reviews TypeScript correctness, provider interface compliance, Next.js 16 patterns (async params, no self-fetch, force-dynamic on search), Tailwind v4 usage.

3. **QA Agent** — tests all features end-to-end:
   - All 7 pages load without error
   - Homepage shows 3 content sections with real data
   - List page genre filter and sort work
   - Manga detail shows chapter list
   - Chapter reader loads all images, prev/next works, mode toggle works
   - Search returns results
   - Bookmark persists across page refresh
   - History records chapter visits

---

## 8. Environment Variables

```env
MANGA_PROVIDER=keikomik
KEIKOMIK_PROJECT_ID=komikapp-677a0
KEIKOMIK_API_KEY=AIzaSyC6Jm-c0blt4T7JxBuMmoh5QNHaRQ0vgJI
NEXT_PUBLIC_BASE_URL=https://mikomi.vercel.app
```

---

## 9. Vercel Deployment Checklist

```
Pre-deploy:
[ ] pnpm tsc --noEmit passes with 0 errors
[ ] All data pages use revalidate (not force-dynamic) except search
[ ] Search page uses force-dynamic
[ ] Pages call getProvider() directly — NOT self-fetching own API routes
[ ] .env.local in .gitignore

Env vars set in Vercel dashboard:
[ ] MANGA_PROVIDER
[ ] KEIKOMIK_PROJECT_ID
[ ] KEIKOMIK_API_KEY
[ ] NEXT_PUBLIC_BASE_URL

Post-deploy smoke tests:
[ ] Homepage loads with real manga cards
[ ] /list shows manga grid with genre filter
[ ] /manga/[slug] shows detail + chapter list
[ ] /chapter/[slug]/1 loads page images
[ ] /search?q=one+piece returns results
[ ] Bookmark saves and persists
[ ] History records chapter visit
```
