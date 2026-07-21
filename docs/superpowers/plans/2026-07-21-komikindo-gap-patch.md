# Komikindo Gap-Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch specific, individually-verified missing chapters into `KiryuuProvider` from `komikindo.ch`, without ever overriding a chapter Kiryuu already has.

**Architecture:** Three new files (`lib/providers/komikindo.ts`, `lib/providers/patch-data.ts` + its JSON data, `scripts/build-komikindo-patches.mjs`) plus a small, isolated change to `lib/providers/kiryuu.ts` that merges patch entries into the chapter list and branches the page-fetch by source. The `MangaProvider` interface and all exported types (`ChapterMeta`, `ChapterDetail`) are untouched.

**Tech Stack:** TypeScript strict, Vitest (`vi.stubGlobal('fetch', ...)` / `vi.mock` — this repo's existing test patterns), Node ESM for the offline maintenance script.

**Spec:** `docs/superpowers/specs/2026-07-21-komikindo-gap-patch-design.md`

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- No changes to `MangaProvider`, the exported `ChapterMeta`, or `ChapterDetail` types (spec §4.3).
- A patch entry is only ever added for a chapter number Kiryuu's own list does not already have (spec §3 decision 3) — enforced at merge time, not just at generation time.
- Patched chapters carry no visible "alternate source" indicator in the reader (spec §3 decision 4) — no UI changes in this plan.
- `komikindo-patches.json` stores only enough to locate a chapter live (manga slug → chapter number → komikindo chapter slug) — never image URLs (spec §4.2).
- Any komikindo failure (unreachable, chapter removed, malformed response) must degrade to "chapter unavailable," never a crash or a broken page (spec §5).
- Page-count sanity check band: 30%–300% of baseline (spec §3 decision 2) — literal values, not tunable in this plan.
- Ascending-probe bound for zero-data titles: stop at 5 consecutive misses or chapter 500, whichever comes first (spec §4.4).

---

### Task 1: `komikindo.ts` — runtime chapter-page fetch

**Files:**
- Create: `lib/providers/komikindo.ts`
- Test: `lib/providers/komikindo.test.ts`

**Interfaces:**
- Produces: `export async function fetchKomikindoChapterPages(chapterSlug: string): Promise<string[]>` — resolves a komikindo chapter post by slug, then returns its page image URLs. Returns `[]` on any failure (post not found, network error, malformed response) — never throws.

- [ ] **Step 1: Write the failing tests**

Create `lib/providers/komikindo.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchKomikindoChapterPages } from './komikindo'

describe('fetchKomikindoChapterPages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves the post id from the slug, then returns its page images', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wp/v2/posts?slug=shura-sword-sovereign-chapter-197')) {
        return new Response(JSON.stringify([{ id: 106116 }]), { status: 200 })
      }
      if (url.includes('/apk/v2/chapter/106116')) {
        return new Response(
          JSON.stringify({ image: ['https://example.com/1.jpg', 'https://example.com/2.jpg'] }),
          { status: 200 }
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg'])
  })

  it('returns an empty array when the slug does not resolve to any post', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify([]), { status: 200 }))

    const pages = await fetchKomikindoChapterPages('does-not-exist-chapter-1')

    expect(pages).toEqual([])
  })

  it('returns an empty array when the post-lookup request fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual([])
  })

  it('returns an empty array when the chapter-content request fails after a successful post lookup', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wp/v2/posts?slug=')) {
        return new Response(JSON.stringify([{ id: 106116 }]), { status: 200 })
      }
      return new Response('', { status: 500 })
    })

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual([])
  })

  it('returns an empty array when the chapter response has no image array', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wp/v2/posts?slug=')) {
        return new Response(JSON.stringify([{ id: 106116 }]), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/providers/komikindo.test.ts`
Expected: FAIL — `Cannot find module './komikindo'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/providers/komikindo.ts`:

```ts
const BASE = 'https://komikindo.ch/wp-json'

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://komikindo.ch/',
}

type KomikindoPost = { id: number }
type KomikindoChapterResponse = { image?: string[] }

// Patched chapters are served from komikindo.ch, never Kiryuu — see
// docs/superpowers/specs/2026-07-21-komikindo-gap-patch-design.md.
// komikindo has no dedicated chapter post type: a chapter's post ID must be
// resolved by exact slug first, then its images fetched via a separate
// custom endpoint. Any failure at either step returns [] — a patched
// chapter going missing must degrade the same as any other 404, never
// break the page.
export async function fetchKomikindoChapterPages(chapterSlug: string): Promise<string[]> {
  try {
    const postRes = await fetch(
      `${BASE}/wp/v2/posts?slug=${encodeURIComponent(chapterSlug)}&_fields=id`,
      { headers: HEADERS }
    )
    if (!postRes.ok) return []
    const posts = await postRes.json() as KomikindoPost[]
    if (!posts[0]) return []

    const chapterRes = await fetch(`${BASE}/apk/v2/chapter/${posts[0].id}`, { headers: HEADERS })
    if (!chapterRes.ok) return []
    const data = await chapterRes.json() as KomikindoChapterResponse
    return data.image ?? []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/providers/komikindo.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/providers/komikindo.ts lib/providers/komikindo.test.ts
git commit -m "feat: fetch chapter pages from komikindo.ch for gap-patched chapters"
```

---

### Task 2: `patch-data.ts` — patch table loader

**Files:**
- Create: `lib/providers/komikindo-patches.json`
- Create: `lib/providers/patch-data.ts`
- Test: `lib/providers/patch-data.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `export function getPatchedChapterNumbers(mangaSlug: string): number[]` — all patched chapter numbers for a manga, `[]` if none.
  - `export function getPatchedChapterSlug(mangaSlug: string, chapterNumber: number): string | null` — the komikindo chapter slug for a specific patched (manga, chapter) pair, `null` if not patched.

- [ ] **Step 1: Create the seed data file**

Create `lib/providers/komikindo-patches.json` — seeded with the two pairs already confirmed live during this feature's design (spec §7 step 2: Shura Sword Sovereign ch.197 has 26 real, loadable pages; Kamonohashi Ron no Kindan Suiri ch.2 confirmed present):

```json
{
  "shura-sword-sovereign": { "197": "shura-sword-sovereign-chapter-197" },
  "kamonohashi-ron-no-kindan-suiri": { "2": "kamonohashi-ron-no-kindan-suiri-chapter-2" }
}
```

- [ ] **Step 2: Write the failing tests**

Create `lib/providers/patch-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getPatchedChapterNumbers, getPatchedChapterSlug } from './patch-data'

describe('getPatchedChapterSlug', () => {
  it('returns the mapped komikindo slug for a known manga and chapter number', () => {
    expect(getPatchedChapterSlug('shura-sword-sovereign', 197)).toBe('shura-sword-sovereign-chapter-197')
  })

  it('returns null for a manga not in the patch table', () => {
    expect(getPatchedChapterSlug('some-manga-with-no-patches', 1)).toBeNull()
  })

  it('returns null for a chapter number not patched for a manga that does have other patches', () => {
    expect(getPatchedChapterSlug('shura-sword-sovereign', 999)).toBeNull()
  })
})

describe('getPatchedChapterNumbers', () => {
  it('returns all patched chapter numbers for a manga', () => {
    expect(getPatchedChapterNumbers('shura-sword-sovereign')).toEqual([197])
  })

  it('returns an empty array for a manga not in the patch table', () => {
    expect(getPatchedChapterNumbers('some-manga-with-no-patches')).toEqual([])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/providers/patch-data.test.ts`
Expected: FAIL — `Cannot find module './patch-data'` (file doesn't exist yet).

- [ ] **Step 4: Write the implementation**

Create `lib/providers/patch-data.ts`:

```ts
import patches from './komikindo-patches.json'

// manga slug -> chapter number (as string, JSON keys are always strings) -> komikindo chapter slug
type PatchTable = Record<string, Record<string, string>>

const table = patches as PatchTable

export function getPatchedChapterNumbers(mangaSlug: string): number[] {
  const forManga = table[mangaSlug]
  if (!forManga) return []
  return Object.keys(forManga).map(Number)
}

export function getPatchedChapterSlug(mangaSlug: string, chapterNumber: number): string | null {
  const forManga = table[mangaSlug]
  if (!forManga) return null
  return forManga[String(chapterNumber)] ?? null
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/providers/patch-data.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/providers/komikindo-patches.json lib/providers/patch-data.ts lib/providers/patch-data.test.ts
git commit -m "feat: patch-data lookup table, seeded with two verified komikindo chapters"
```

---

### Task 3: Merge patched chapters into `KiryuuProvider`

**Files:**
- Modify: `lib/providers/kiryuu.ts`
- Modify: `lib/providers/kiryuu.test.ts`

**Interfaces:**
- Consumes:
  - `fetchKomikindoChapterPages(chapterSlug: string): Promise<string[]>` from Task 1 (`./komikindo`)
  - `getPatchedChapterNumbers(mangaSlug: string): number[]` and `getPatchedChapterSlug(mangaSlug: string, chapterNumber: number): string | null` from Task 2 (`./patch-data`)
- Produces: no new exports — `getManga` and `getChapter` (already part of `MangaProvider`) transparently include and serve patched chapters.

- [ ] **Step 1: Write the failing tests**

Add to `lib/providers/kiryuu.test.ts`, near the top, right after the existing imports (this repo's other describe blocks don't mock modules, only `vi.stubGlobal('fetch', ...)` — these two new mocks are additive and every existing test is unaffected because the default return values below are empty/null, so `mergePatchedChapters` becomes a no-op unless a test explicitly configures otherwise):

```ts
import { getPatchedChapterNumbers, getPatchedChapterSlug } from './patch-data'
import { fetchKomikindoChapterPages } from './komikindo'

vi.mock('./patch-data', () => ({
  getPatchedChapterNumbers: vi.fn(() => []),
  getPatchedChapterSlug: vi.fn(() => null),
}))
vi.mock('./komikindo', () => ({
  fetchKomikindoChapterPages: vi.fn(async () => []),
}))
```

Then add a new describe block at the end of the file:

```ts
describe('KiryuuProvider komikindo patch merging', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(getPatchedChapterNumbers).mockReturnValue([])
    vi.mocked(getPatchedChapterSlug).mockReturnValue(null)
    vi.mocked(fetchKomikindoChapterPages).mockResolvedValue([])
  })

  const wpJson = (body: unknown, total = 0) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-WP-Total': String(total) },
    })

  it('getManga adds a patched chapter number Kiryuu does not have', async () => {
    const slug = 'im-a-test-manga-but-cool'
    vi.mocked(getPatchedChapterNumbers).mockReturnValue([197])
    vi.mocked(getPatchedChapterSlug).mockReturnValue('im-a-test-manga-but-cool-chapter-197')

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_embed')) {
        return wpJson([{
          id: 1, slug, title: { rendered: 'I&#8217;m a Test Manga, but Cool' },
          excerpt: { rendered: '' }, modified: '2026-07-21T00:00:00',
        }], 1)
      }
      if (url.includes('/manga?') && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'I&#8217;m a Test Manga, but Cool' } }], 1)
      }
      if (url.includes('/chapter?') && url.includes('search_columns=post_title')) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-196`, date: '2026-07-01', title: { rendered: 'Test Manga but Cool Chapter 196' } },
        ], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)

    expect(manga.chapters.map(c => c.number)).toEqual([197, 196])
  })

  it('getManga does not add a patch entry for a chapter number Kiryuu already has', async () => {
    const slug = 'im-a-test-manga-but-cool'
    vi.mocked(getPatchedChapterNumbers).mockReturnValue([196])
    vi.mocked(getPatchedChapterSlug).mockReturnValue('im-a-test-manga-but-cool-chapter-196')

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_embed')) {
        return wpJson([{
          id: 1, slug, title: { rendered: 'I&#8217;m a Test Manga, but Cool' },
          excerpt: { rendered: '' }, modified: '2026-07-21T00:00:00',
        }], 1)
      }
      if (url.includes('/manga?') && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'I&#8217;m a Test Manga, but Cool' } }], 1)
      }
      if (url.includes('/chapter?') && url.includes('search_columns=post_title')) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-196`, date: '2026-07-01', title: { rendered: 'Test Manga but Cool Chapter 196' } },
        ], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)

    expect(manga.chapters).toHaveLength(1)
    expect(manga.chapters[0].number).toBe(196)
  })

  it("getChapter serves a patched chapter's pages from komikindo and resolves prev/next against the merged list", async () => {
    const slug = 'im-a-test-manga-but-cool'
    vi.mocked(getPatchedChapterNumbers).mockReturnValue([197])
    vi.mocked(getPatchedChapterSlug).mockReturnValue('im-a-test-manga-but-cool-chapter-197')
    vi.mocked(fetchKomikindoChapterPages).mockResolvedValue(['https://komikindo-cdn.example/1.jpg'])

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'I&#8217;m a Test Manga, but Cool' } }], 1)
      }
      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_embed=wp:featuredmedia')) {
        return wpJson([{ id: 1, title: { rendered: 'I&#8217;m a Test Manga, but Cool' }, _embedded: {} }], 1)
      }
      if (url.includes('/chapter?') && url.includes('search_columns=post_title')) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-196`, date: '2026-07-01', title: { rendered: 'Test Manga but Cool Chapter 196' } },
        ], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await new KiryuuProvider().getChapter(slug, 197)

    expect(result.pages).toEqual(['https://komikindo-cdn.example/1.jpg'])
    expect(result.prev).toBe(196)
    expect(result.next).toBeNull()
    expect(fetchKomikindoChapterPages).toHaveBeenCalledWith('im-a-test-manga-but-cool-chapter-197')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/providers/kiryuu.test.ts -t "komikindo patch merging"`
Expected: FAIL — `manga.chapters.map(...)` does not include `197` (patch merging not implemented yet), and `fetchKomikindoChapterPages` is never called.

- [ ] **Step 3: Write the implementation**

In `lib/providers/kiryuu.ts`, add imports near the top (after the existing imports):

```ts
import { getPatchedChapterNumbers, getPatchedChapterSlug } from './patch-data'
import { fetchKomikindoChapterPages } from './komikindo'
```

Change the internal-only chapter type (currently `type ChapterMetaWithSlug = ChapterMeta & { slug: string }`) to:

```ts
// Internal-only: carries the exact WP slug alongside the parsed chapter number,
// so getChapter can fetch content by real slug instead of guessing one.
// `source: 'komikindo'` marks a chapter merged in from the gap-patch table —
// its `slug` is a komikindo chapter slug, not a Kiryuu one, and must only
// ever be passed to fetchKomikindoChapterPages, never Kiryuu's own content URL.
type ChapterMetaWithSlug = ChapterMeta & { slug: string; source?: 'komikindo' }
```

Add a new private method to the `KiryuuProvider` class (place it right after `searchChapters`, before `getPopular`):

```ts
  // Adds any patched chapters komikindo has for this manga that Kiryuu's own
  // chapters list doesn't already cover — never overrides an existing Kiryuu
  // chapter number (spec: patches only ever fill a hole, never replace).
  private mergePatchedChapters(mangaSlug: string, chapters: ChapterMetaWithSlug[]): ChapterMetaWithSlug[] {
    const existingNumbers = new Set(chapters.map(c => c.number))
    const patchedNumbers = getPatchedChapterNumbers(mangaSlug).filter(n => !existingNumbers.has(n))
    if (patchedNumbers.length === 0) return chapters

    const patched: ChapterMetaWithSlug[] = patchedNumbers.map(number => ({
      number,
      updatedAt: '',
      note: '',
      slug: getPatchedChapterSlug(mangaSlug, number) as string,
      source: 'komikindo',
    }))

    return [...chapters, ...patched].sort((a, b) => b.number - a.number)
  }
```

In `getManga`, change:

```ts
    const chapters = await this.fetchChapters(slug)
```

to:

```ts
    const chapters = this.mergePatchedChapters(slug, await this.fetchChapters(slug))
```

Replace the entire existing `getChapter` method (from `async getChapter(slug: string, chapter: number): Promise<ChapterDetail> {` through its closing `}`) with the following two methods together — the new `getChapter` plus a new private `fetchKiryuuPages` helper placed directly after it (this helper extracts the content-fetch-and-parse logic that used to live inline in `getChapter`, unchanged in behavior, just isolated so the branch between Kiryuu and komikindo reads cleanly):

```ts
  async getChapter(slug: string, chapter: number): Promise<ChapterDetail> {
    // Resolve against the real chapter list first, rather than guessing a slug —
    // some chapters are reposted with a non-numeric suffix ("…chapter-59-fix"),
    // so a plain "manga-chapter-59" guess 404s even though the chapter exists.
    const [rawChapters, mangaList] = await Promise.all([
      this.fetchChapters(slug),
      kfetch<WPManga[]>(
        `${BASE}/manga?slug=${encodeURIComponent(slug)}&_embed=wp:featuredmedia&_fields=id,title,_embedded,_links`,
        3600
      ),
    ])
    const allChapters = this.mergePatchedChapters(slug, rawChapters)

    const nums = allChapters.map(c => c.number) // sorted desc
    const idx  = nums.indexOf(chapter)
    if (idx === -1) throw new Error(`Chapter ${chapter} not found: ${slug}`)
    const target = allChapters[idx]

    const pages = target.source === 'komikindo'
      ? await fetchKomikindoChapterPages(target.slug)
      : await this.fetchKiryuuPages(target.slug)
    if (pages.length === 0) throw new Error(`Chapter ${chapter} not found: ${slug}`)

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

  // Gambar langsung dari CDN Kiryuu — tidak ada proxy
  private async fetchKiryuuPages(targetSlug: string): Promise<string[]> {
    const chapterList = await kfetch<WPChapter[]>(
      `${BASE}/chapter?slug=${encodeURIComponent(targetSlug)}&_fields=content`,
      86400
    )
    if (!chapterList.length) return []
    return parseImages(chapterList[0].content?.rendered ?? '')
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/providers/kiryuu.test.ts`
Expected: PASS — all pre-existing tests plus the 3 new ones green (the pre-existing tests are unaffected: default mocks return no patches, so `mergePatchedChapters` is a no-op for them).

- [ ] **Step 5: Type-check and run the full suite**

Run: `npx tsc --noEmit`
Expected: no output (clean).

Run: `npx vitest run`
Expected: all test files pass.

- [ ] **Step 6: Commit**

```bash
git add lib/providers/kiryuu.ts lib/providers/kiryuu.test.ts
git commit -m "feat: merge komikindo gap-patch chapters into KiryuuProvider"
```

---

### Task 4: Maintenance script to (re)generate the patch table

**Files:**
- Data already present in the repo (prepared alongside this plan): `scripts/data/kiryuu-gaps.json` — 554 entries under `missing` (`{ slug, title, gapRanges }`, `gapRanges` a comma-separated list of integers and/or `start-end` ranges, e.g. `"197, 321-396"`), 691 entries under `noData` (`{ slug, title }`) — sourced from the 2026-07-21 full-catalog audit plus the manual reclassifications made during that audit (docs/superpowers/specs/2026-07-21-komikindo-gap-patch-design.md §1). The spec's "703" figure for zero-data titles includes 12 titles where Kiryuu found some posts but none had a parseable chapter number — those don't fit either probing model cleanly (no gap list, and "some content exists but we don't know what") and are excluded from this data file; 691 is the clean subset.
- Create: `scripts/build-komikindo-patches.mjs`

**Interfaces:**
- Consumes: `scripts/data/kiryuu-gaps.json` (read-only input, already in the repo).
- Produces: overwrites `lib/providers/komikindo-patches.json` (consumed by Task 2's `patch-data.ts` — same shape: manga slug → chapter number string → komikindo chapter slug). Also writes `scripts/data/komikindo-patch-rejections.json` (an array of `{ title, chapter?, reason }` for visibility into what was excluded and why — not consumed by the app, diagnostic only).

This script is a one-off maintenance tool (same category as this session's ad-hoc audit scripts) — not part of the Next.js build, not unit-tested. Its own test cycle is running it against a small real sample and checking the output against chapters already manually verified during this feature's design.

- [ ] **Step 1: Write the script**

Create `scripts/build-komikindo-patches.mjs`:

```js
#!/usr/bin/env node
// Regenerates lib/providers/komikindo-patches.json from scratch each run.
// For every title in scripts/data/kiryuu-gaps.json, resolves the manga on
// komikindo.ch, probes candidate chapter numbers, and only keeps a match
// that passes both verification gates (title cross-check, page-count
// sanity check) — see docs/superpowers/specs/2026-07-21-komikindo-gap-patch-design.md.
const KOMIKINDO_BASE = 'https://komikindo.ch/wp-json'
const KIRYUU_BASE = 'https://v7.kiryuu.to/wp-json/wp/v2'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' }
const CONCURRENCY = 8
const REQUEST_TIMEOUT_MS = 12000
const fs = await import('fs')
const path = await import('path')
const { fileURLToPath } = await import('url')

process.on('unhandledRejection', (err) => console.error('UNHANDLED REJECTION (continuing):', err))
process.on('uncaughtException', (err) => console.error('UNCAUGHT EXCEPTION (continuing):', err))

function decodeHtml(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”')
}

async function fetchT(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try { return await fetch(url, { headers: HEADERS, signal: ctrl.signal }) }
  finally { clearTimeout(t) }
}

async function resolveKomikindoSlug(title) {
  const res = await fetchT(`${KOMIKINDO_BASE}/wp/v2/manga?search=${encodeURIComponent(title)}&per_page=3&_fields=slug,title`)
  if (!res.ok) return null
  const matches = await res.json()
  const exact = matches.find(m => decodeHtml(m.title.rendered).toLowerCase() === title.toLowerCase())
  return exact ? exact.slug : (matches[0] ? matches[0].slug : null)
}

async function findKomikindoPost(chapterSlug) {
  const res = await fetchT(`${KOMIKINDO_BASE}/wp/v2/posts?slug=${encodeURIComponent(chapterSlug)}&_fields=id,title`)
  if (!res.ok) return null
  const posts = await res.json()
  return posts[0] ?? null
}

async function komikindoPageCount(postId) {
  const res = await fetchT(`${KOMIKINDO_BASE}/apk/v2/chapter/${postId}`)
  if (!res.ok) return 0
  const data = await res.json()
  return Array.isArray(data.image) ? data.image.length : 0
}

async function kiryuuAveragePageCount(kiryuuSlug) {
  const res = await fetchT(`${KIRYUU_BASE}/chapter?search=${encodeURIComponent(kiryuuSlug)}&per_page=100&_fields=slug`)
  if (!res.ok) return null
  const posts = await res.json()
  if (posts.length === 0) return null
  const sample = posts.slice(0, 3)
  const counts = await Promise.all(sample.map(async (p) => {
    const r = await fetchT(`${KIRYUU_BASE}/chapter?slug=${encodeURIComponent(p.slug)}&_fields=content`)
    if (!r.ok) return 0
    const d = await r.json()
    return (d[0]?.content?.rendered.match(/<img[^>]+src=/gi) || []).length
  }))
  const valid = counts.filter(c => c > 0)
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

function titleStatesChapter(titleText, n) {
  const m = decodeHtml(titleText ?? '').match(/Chapter\s+\D*?(\d+(?:\.\d+)?)/i)
  return m !== null && Number(m[1]) === n
}

async function verifyCandidate(kiryuuSlug, chapterSlug, n, komikindoNeighborCounts) {
  const post = await findKomikindoPost(chapterSlug)
  if (!post) return { ok: false, reason: 'not-found' }
  if (!titleStatesChapter(post.title?.rendered, n)) return { ok: false, reason: 'title-mismatch' }

  const pageCount = await komikindoPageCount(post.id)
  if (pageCount === 0) return { ok: false, reason: 'no-pages' }

  let baseline = await kiryuuAveragePageCount(kiryuuSlug)
  if (baseline === null) {
    const valid = komikindoNeighborCounts.filter(c => c > 0)
    baseline = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  }
  if (baseline !== null) {
    const ratio = pageCount / baseline
    if (ratio < 0.3 || ratio > 3) {
      return { ok: false, reason: `page-count-outlier (${pageCount} vs baseline ${baseline.toFixed(1)})` }
    }
  }

  return { ok: true, chapterSlug, pageCount }
}

async function withConcurrency(items, limit, fn) {
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try { await fn(items[i], i) } catch (e) { console.error('item error:', items[i]?.slug, e) }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
}

function expandGapRanges(gapRanges) {
  return gapRanges.split(', ').flatMap(range => {
    const [start, end] = range.split('-').map(Number)
    return end === undefined ? [start] : Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const gaps = JSON.parse(fs.readFileSync(path.join(scriptDir, 'data', 'kiryuu-gaps.json'), 'utf8'))

const patches = {}
const rejected = []
let scanned = 0
const total = gaps.missing.length + gaps.noData.length

await withConcurrency(gaps.missing, CONCURRENCY, async (entry) => {
  scanned++
  if (scanned % 20 === 0) console.error(`  ...${scanned}/${total}`)

  const komikindoSlug = await resolveKomikindoSlug(entry.title)
  if (!komikindoSlug) { rejected.push({ title: entry.title, reason: 'manga-not-found' }); return }

  for (const n of expandGapRanges(entry.gapRanges)) {
    const chapterSlug = `${komikindoSlug}-chapter-${n}`
    const result = await verifyCandidate(entry.slug, chapterSlug, n, [])
    if (result.ok) {
      patches[entry.slug] ??= {}
      patches[entry.slug][String(n)] = result.chapterSlug
    } else {
      rejected.push({ title: entry.title, chapter: n, reason: result.reason })
    }
  }
})

await withConcurrency(gaps.noData, CONCURRENCY, async (entry) => {
  scanned++
  if (scanned % 20 === 0) console.error(`  ...${scanned}/${total}`)

  const komikindoSlug = await resolveKomikindoSlug(entry.title)
  if (!komikindoSlug) { rejected.push({ title: entry.title, reason: 'manga-not-found' }); return }

  let consecutiveMisses = 0
  const neighborCounts = []
  for (let n = 1; n <= 500 && consecutiveMisses < 5; n++) {
    const chapterSlug = `${komikindoSlug}-chapter-${n}`
    const result = await verifyCandidate(entry.slug, chapterSlug, n, neighborCounts)
    if (result.ok) {
      patches[entry.slug] ??= {}
      patches[entry.slug][String(n)] = result.chapterSlug
      neighborCounts.push(result.pageCount)
      consecutiveMisses = 0
    } else {
      consecutiveMisses++
      rejected.push({ title: entry.title, chapter: n, reason: result.reason })
    }
  }
})

fs.writeFileSync(
  path.join(scriptDir, '..', 'lib', 'providers', 'komikindo-patches.json'),
  JSON.stringify(patches, null, 2)
)
fs.writeFileSync(
  path.join(scriptDir, 'data', 'komikindo-patch-rejections.json'),
  JSON.stringify(rejected, null, 2)
)

console.error(`\nDone: ${scanned} titles scanned, ${Object.keys(patches).length} titles patched, ${rejected.length} rejected — see scripts/data/komikindo-patch-rejections.json`)
```

- [ ] **Step 2: Smoke-test the script against a tiny known sample**

Before running it against all 1,245 titles, verify it against just the 2 already-confirmed pairs. Temporarily create `scripts/data/kiryuu-gaps-sample.json`:

```json
{
  "missing": [
    { "slug": "shura-sword-sovereign", "title": "Shura Sword Sovereign", "gapRanges": "197" },
    { "slug": "kamonohashi-ron-no-kindan-suiri", "title": "Kamonohashi Ron no Kindan Suiri", "gapRanges": "2" }
  ],
  "noData": []
}
```

Run a one-off variant pointed at the sample file:

```bash
node -e "
const fs = require('fs');
const script = fs.readFileSync('scripts/build-komikindo-patches.mjs', 'utf8')
  .replace(\"'kiryuu-gaps.json'\", \"'kiryuu-gaps-sample.json'\");
fs.writeFileSync('scripts/build-komikindo-patches-sample.mjs', script);
"
node scripts/build-komikindo-patches-sample.mjs
cat lib/providers/komikindo-patches.json
```

Expected output: both pairs present, matching:

```json
{
  "shura-sword-sovereign": { "197": "shura-sword-sovereign-chapter-197" },
  "kamonohashi-ron-no-kindan-suiri": { "2": "kamonohashi-ron-no-kindan-suiri-chapter-2" }
}
```

Then restore the real seed data (the sample run overwrote it) and remove the temporary files:

```bash
git checkout lib/providers/komikindo-patches.json
rm scripts/data/kiryuu-gaps-sample.json scripts/build-komikindo-patches-sample.mjs
```

- [ ] **Step 3: Run the existing test suite once more to confirm nothing broke**

Run: `npx vitest run`
Expected: all test files pass (this task added no new automated tests, only the manual smoke test above).

- [ ] **Step 4: Commit**

```bash
git add scripts/build-komikindo-patches.mjs scripts/data/kiryuu-gaps.json
git commit -m "feat: maintenance script to regenerate the komikindo gap-patch table"
```

**Note for whoever runs this next:** the full run against all 1,245 titles (554 missing + 691 no-data) takes a while (each `noData` title can probe up to 500 chapter numbers) and should be run deliberately, not as part of this plan's execution — review `scripts/data/komikindo-patch-rejections.json` afterward before trusting the regenerated `komikindo-patches.json` in production.
