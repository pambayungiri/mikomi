# Auto-Load Next Chapter on Scroll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In strip mode, the next chapter fetches ~1500px before the end and appends seamlessly after a divider; URL, top bar, reading history, and offline cache follow the active chapter. In single-page mode, the last page's "next" navigates to the next chapter.

**Architecture:** `ChapterReader` holds `LoadedChapter[]` seeded by SSR props. An IntersectionObserver sentinel triggers fetches to `/api/chapter/[slug]/[num]` (extended to return `{ chapter, pages, prev, next }`). The existing scroll handler computes the active chapter and per-chapter progress from pure helpers in `lib/reader.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, vitest + @testing-library/react (jsdom), Tailwind 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-20-auto-next-chapter-design.md`

## Global Constraints

- Branch: `fix/kiryuu-v7-hosts`. Commit after every task.
- pnpm scripts fail with `ERR_PNPM_IGNORED_BUILDS` on this machine. Run tools directly: tests via `node node_modules/vitest/vitest.mjs run <path>`, build via `node node_modules/next/dist/bin/next build`.
- Tests are colocated next to the file under test (`lib/storage.test.ts` pattern).
- User-facing copy is Indonesian; use the exact strings given in each task.
- Match existing styling utilities (`text-muted`, `bg-surface-2`, `border-border`, `text-accent`) — do not invent new design tokens.
- Reader currently at `components/ChapterReader.tsx` (303 lines). Tasks 4–6 modify it in sequence; line anchors reference the state after the previous task.

---

### Task 1: API route — decimal chapters + full metadata

**Files:**
- Modify: `app/api/chapter/[slug]/[num]/route.ts`
- Test (create): `app/api/chapter/[slug]/[num]/route.test.ts`

**Interfaces:**
- Consumes: `getProvider().getChapter(slug, chapter)` → `{ mangaSlug, mangaName, mangaImage, chapter, pages, prev, next }` (already exists).
- Produces: `GET /api/chapter/<slug>/<num>` → JSON `{ chapter: number, pages: string[], prev: number | null, next: number | null }`. Accepts decimal `num` ("9.1"). Tasks 4–5 rely on this exact shape.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/chapter/[slug]/[num]/route.test.ts
import { describe, it, expect, vi } from 'vitest'

const getChapter = vi.fn()
vi.mock('@/lib/providers', () => ({
  getProvider: () => ({ getChapter }),
}))

const { GET } = await import('./route')

function makeParams(slug: string, num: string) {
  return { params: Promise.resolve({ slug, num }) }
}

describe('GET /api/chapter/[slug]/[num]', () => {
  it('returns chapter, pages, prev, next', async () => {
    getChapter.mockResolvedValueOnce({
      mangaSlug: 'x', mangaName: 'X', mangaImage: '',
      chapter: 2, pages: ['a.jpg', 'b.jpg'], prev: 1, next: 3,
    })
    const res = await GET(new Request('http://t/api/chapter/x/2'), makeParams('x', '2'))
    expect(await res.json()).toEqual({ chapter: 2, pages: ['a.jpg', 'b.jpg'], prev: 1, next: 3 })
  })

  it('accepts decimal chapter numbers without truncating', async () => {
    getChapter.mockResolvedValueOnce({
      mangaSlug: 'x', mangaName: 'X', mangaImage: '',
      chapter: 9.1, pages: ['p.jpg'], prev: 8.3, next: 9.2,
    })
    const res = await GET(new Request('http://t/api/chapter/x/9.1'), makeParams('x', '9.1'))
    expect(getChapter).toHaveBeenLastCalledWith('x', 9.1)
    expect((await res.json()).chapter).toBe(9.1)
  })

  it('400s on a non-numeric chapter', async () => {
    const res = await GET(new Request('http://t/api/chapter/x/abc'), makeParams('x', 'abc'))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run "app/api/chapter/[slug]/[num]/route.test.ts"`
Expected: FAIL — first test gets `{ pages: [...] }` without `chapter/prev/next`; second test: `getChapter` called with `9` (parseInt truncation), not `9.1`.

- [ ] **Step 3: Update the route**

Replace the body of `GET` in `app/api/chapter/[slug]/[num]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; num: string }> }
) {
  try {
    const { slug, num } = await params
    const chapter = parseFloat(num)
    if (isNaN(chapter)) return NextResponse.json({ error: 'Invalid chapter' }, { status: 400 })

    const provider = getProvider()
    const data = await provider.getChapter(slug, chapter)
    return NextResponse.json({
      chapter: data.chapter,
      pages:   data.pages,
      prev:    data.prev,
      next:    data.next,
    })
  } catch {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run "app/api/chapter/[slug]/[num]/route.test.ts"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/api/chapter/[slug]/[num]/route.ts" "app/api/chapter/[slug]/[num]/route.test.ts"
git commit -m "feat: chapter API returns prev/next metadata, accepts decimal chapters"
```

---

### Task 2: Pure boundary math — `lib/reader.ts`

**Files:**
- Create: `lib/reader.ts`
- Test (create): `lib/reader.test.ts`

**Interfaces:**
- Produces (Task 5 consumes exactly these):
  - `type ChapterBounds = { top: number; height: number }`
  - `activeChapterIndex(bounds: ChapterBounds[], scrollY: number, viewportH: number): number` — index of the chapter containing the viewport midline (`scrollY + viewportH / 2`); the last chapter whose `top <= midline`; `0` if none/empty-safe.
  - `chapterProgress(bounds: ChapterBounds, scrollY: number, viewportH: number): number` — 0–100, how far the viewport *bottom* has traveled through the chapter.

- [ ] **Step 1: Write the failing test**

```ts
// lib/reader.test.ts
import { describe, it, expect } from 'vitest'
import { activeChapterIndex, chapterProgress } from './reader'

const bounds = [
  { top: 0,    height: 3000 },
  { top: 3000, height: 2000 },
  { top: 5000, height: 4000 },
]

describe('activeChapterIndex', () => {
  it('returns the chapter containing the viewport midline', () => {
    expect(activeChapterIndex(bounds, 0, 800)).toBe(0)        // midline 400
    expect(activeChapterIndex(bounds, 2800, 800)).toBe(1)     // midline 3200
    expect(activeChapterIndex(bounds, 5200, 800)).toBe(2)     // midline 5600
  })

  it('clamps at the edges', () => {
    expect(activeChapterIndex(bounds, 100000, 800)).toBe(2)
    expect(activeChapterIndex([], 500, 800)).toBe(0)
  })
})

describe('chapterProgress', () => {
  it('is 100 when the viewport bottom reaches the chapter end', () => {
    expect(chapterProgress({ top: 0, height: 3000 }, 2200, 800)).toBe(100) // bottom = 3000
  })

  it('is proportional inside the chapter', () => {
    expect(chapterProgress({ top: 3000, height: 2000 }, 3200, 800)).toBe(50) // bottom 4000, 1000/2000
  })

  it('clamps to 0-100', () => {
    expect(chapterProgress({ top: 3000, height: 2000 }, 0, 800)).toBe(0)
    expect(chapterProgress({ top: 0, height: 100 }, 5000, 800)).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run lib/reader.test.ts`
Expected: FAIL — `Cannot find module './reader'`

- [ ] **Step 3: Implement**

```ts
// lib/reader.ts
export type ChapterBounds = { top: number; height: number }

// Index of the chapter containing the viewport midline. Chapters are stacked
// in document order, so the answer is the last chapter starting above the midline.
export function activeChapterIndex(
  bounds: ChapterBounds[],
  scrollY: number,
  viewportH: number
): number {
  const midline = scrollY + viewportH / 2
  let active = 0
  for (let i = 0; i < bounds.length; i++) {
    if (bounds[i].top <= midline) active = i
  }
  return active
}

// How far the viewport bottom has traveled through a chapter, 0-100.
export function chapterProgress(
  bound: ChapterBounds,
  scrollY: number,
  viewportH: number
): number {
  if (bound.height <= 0) return 100
  const bottom = scrollY + viewportH
  const pct = ((bottom - bound.top) / bound.height) * 100
  return Math.max(0, Math.min(100, pct))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node node_modules/vitest/vitest.mjs run lib/reader.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/reader.ts lib/reader.test.ts
git commit -m "feat: pure boundary math for active chapter and per-chapter progress"
```

---

### Task 3: Shared history write — `recordHistory` in `lib/storage.ts`

**Files:**
- Modify: `lib/storage.ts` (append function at end of file)
- Modify: `components/HistoryTracker.tsx` (use the helper)
- Test (modify): `lib/storage.test.ts` (append a describe block)

**Interfaces:**
- Consumes: existing `readStorage`, `writeStorage`, `STORAGE_KEYS`, `HistoryEntry`.
- Produces: `recordHistory(entry: Omit<HistoryEntry, 'timestamp'>): void` — dedupes same slug+chapter, prepends, caps at 100. Task 5 calls this from the reader.

- [ ] **Step 1: Write the failing test** — append to `lib/storage.test.ts`:

```ts
import { recordHistory, type HistoryEntry } from './storage'

describe('recordHistory', () => {
  beforeEach(() => localStorage.clear())

  const entry = { slug: 'a', chapter: 1, mangaName: 'A', mangaImage: 'a.jpg' }

  it('prepends a new entry with a timestamp', () => {
    recordHistory(entry)
    const list = JSON.parse(localStorage.getItem('mikomi_history')!) as HistoryEntry[]
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject(entry)
    expect(list[0].timestamp).toBeTypeOf('number')
  })

  it('dedupes the same slug+chapter and moves it to the front', () => {
    recordHistory(entry)
    recordHistory({ ...entry, slug: 'b' })
    recordHistory(entry) // again — should move to front, not duplicate
    const list = JSON.parse(localStorage.getItem('mikomi_history')!) as HistoryEntry[]
    expect(list).toHaveLength(2)
    expect(list[0].slug).toBe('a')
  })

  it('caps the list at 100 entries', () => {
    for (let i = 0; i < 105; i++) recordHistory({ ...entry, chapter: i })
    const list = JSON.parse(localStorage.getItem('mikomi_history')!) as HistoryEntry[]
    expect(list).toHaveLength(100)
  })
})
```

(`describe`/`beforeEach`/`it`/`expect` are already imported at the top of the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run lib/storage.test.ts`
Expected: FAIL — `recordHistory` is not exported.

- [ ] **Step 3: Implement** — append to `lib/storage.ts`:

```ts
export function recordHistory(entry: Omit<HistoryEntry, 'timestamp'>): void {
  const existing = readStorage<HistoryEntry[]>(STORAGE_KEYS.history, [])
  const filtered = existing.filter(
    e => !(e.slug === entry.slug && e.chapter === entry.chapter)
  )
  writeStorage(STORAGE_KEYS.history, [
    { ...entry, timestamp: Date.now() },
    ...filtered,
  ].slice(0, 100))
}
```

Then replace the `useEffect` body in `components/HistoryTracker.tsx` so it delegates:

```tsx
'use client'

import { useEffect } from 'react'
import { recordHistory } from '@/lib/storage'

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
    recordHistory({ slug, chapter, mangaName, mangaImage })
  }, [slug, chapter, mangaName, mangaImage])

  return null
}
```

- [ ] **Step 4: Run the full suite (guards the HistoryTracker refactor)**

Run: `node node_modules/vitest/vitest.mjs run`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts components/HistoryTracker.tsx
git commit -m "refactor: extract recordHistory into lib/storage for reuse by the reader"
```

---

### Task 4: ChapterReader — multi-chapter state, sentinel fetch, dividers (strip mode)

**Files:**
- Modify: `components/ChapterReader.tsx`
- Test (create): `components/ChapterReader.test.tsx`

**Interfaces:**
- Consumes: Task 1's response shape `{ chapter, pages, prev, next }`; existing props `{ pages, slug, chapter, prev, next, mangaName }`.
- Produces: internal state Tasks 5–6 build on:
  - `type LoadedChapter = { number: number; pages: string[]; prev: number | null; next: number | null }`
  - `chapters: LoadedChapter[]`, `activeIdx: number`
  - `tail: { status: 'idle' | 'loading' | 'error' | 'last' | 'empty'; chapter?: number }`
  - `chapterRefs: React.MutableRefObject<(HTMLDivElement | null)[]>` (one wrapper div per chapter)
- Divider copy (exact): between chapters `Ch. {prevNumber} selesai · Ch. {number}`; error `Gagal memuat Ch. {chapter}` with button `Coba lagi`; last `Chapter terakhir` with link `Kembali ke {mangaName}`; empty `Ch. {chapter} belum tersedia` with the same link.

- [ ] **Step 1: Write the failing component test**

```tsx
// components/ChapterReader.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChapterReader from './ChapterReader'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// jsdom has no IntersectionObserver — capture instances so tests fire them manually
type IOCallback = (entries: { isIntersecting: boolean }[]) => void
const observers: { cb: IOCallback; observed: Element[] }[] = []
class FakeIO {
  observed: Element[] = []
  constructor(private cb: IOCallback) { observers.push({ cb, observed: this.observed }) }
  observe(el: Element) { this.observed.push(el) }
  unobserve() {}
  disconnect() {}
}

function fireSentinel() {
  // last-registered observer is the sentinel's
  observers.at(-1)!.cb([{ isIntersecting: true }])
}

const baseProps = {
  pages: ['https://v7.kiryuu.to/p1.jpg', 'https://v7.kiryuu.to/p2.jpg'],
  slug: 'test-slug',
  chapter: 1,
  prev: null,
  next: 2,
  mangaName: 'Test Manga',
}

describe('ChapterReader auto-append', () => {
  beforeEach(() => {
    localStorage.clear()
    observers.length = 0
    vi.stubGlobal('IntersectionObserver', FakeIO)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fetches and appends the next chapter when the sentinel intersects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      chapter: 2, pages: ['https://v7.kiryuu.to/p3.jpg'], prev: 1, next: 3,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ChapterReader {...baseProps} />)
    fireSentinel()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/chapter/test-slug/2')
    )
    // divider + appended page
    expect(await screen.findByText(/Ch\. 1 selesai · Ch\. 2/)).toBeInTheDocument()
    expect(screen.getAllByRole('img').length).toBe(3)
  })

  it('shows a retry divider when the fetch fails, and retries on tap', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        chapter: 2, pages: ['https://v7.kiryuu.to/p3.jpg'], prev: 1, next: 3,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ChapterReader {...baseProps} />)
    fireSentinel()

    const retry = await screen.findByRole('button', { name: /coba lagi/i })
    expect(screen.getByText(/Gagal memuat Ch\. 2/)).toBeInTheDocument()
    fireEvent.click(retry)
    expect(await screen.findByText(/Ch\. 1 selesai · Ch\. 2/)).toBeInTheDocument()
  })

  it('shows the end divider when there is no next chapter', async () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<ChapterReader {...baseProps} next={null} />)
    expect(await screen.findByText(/Chapter terakhir/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run components/ChapterReader.test.tsx`
Expected: FAIL — no divider text, no fetch on intersect (component doesn't have the feature yet). If the render itself crashes on the missing `IntersectionObserver` before stubbing, the stub in `beforeEach` prevents that.

- [ ] **Step 3: Implement in `components/ChapterReader.tsx`**

3a. Add types/state/refs near the top of the component (after the existing `useState` block, before the first `useEffect`):

```tsx
type LoadedChapter = { number: number; pages: string[]; prev: number | null; next: number | null }

// inside ChapterReader():
const [chapters, setChapters] = useState<LoadedChapter[]>([
  { number: chapter, pages, prev, next },
])
const [activeIdx, setActiveIdx] = useState(0)
const [tail, setTail] = useState<{ status: 'idle' | 'loading' | 'error' | 'last' | 'empty'; chapter?: number }>(
  next === null ? { status: 'last' } : { status: 'idle' }
)
const chapterRefs = useRef<(HTMLDivElement | null)[]>([])
const sentinelRef = useRef<HTMLDivElement | null>(null)
const activeChapter = chapters[activeIdx] ?? chapters[0]
```

3b. Add the fetch-next callback and sentinel observer (new effects, after the existing offline-cache effect):

```tsx
const loadNext = useCallback(async () => {
  const last = chapters[chapters.length - 1]
  if (last.next === null) { setTail({ status: 'last' }); return }
  setTail({ status: 'loading', chapter: last.next })
  try {
    const res = await fetch(`/api/chapter/${slug}/${last.next}`)
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { chapter: number; pages: string[]; prev: number | null; next: number | null }
    if (data.pages.length === 0) { setTail({ status: 'empty', chapter: data.chapter }); return }
    setChapters(cs => [...cs, { number: data.chapter, pages: data.pages, prev: data.prev, next: data.next }])
    setTail(data.next === null ? { status: 'last' } : { status: 'idle' })
  } catch {
    setTail({ status: 'error', chapter: last.next })
  }
}, [chapters, slug])

const loadNextRef = useRef(loadNext)
useEffect(() => { loadNextRef.current = loadNext }, [loadNext])

useEffect(() => {
  if (mode !== 'strip' || tail.status !== 'idle') return
  const el = sentinelRef.current
  if (!el || typeof IntersectionObserver === 'undefined') return
  const io = new IntersectionObserver(
    entries => { if (entries.some(e => e.isIntersecting)) loadNextRef.current() },
    { rootMargin: '1500px 0px' }
  )
  io.observe(el)
  return () => io.disconnect()
}, [mode, chapters.length, tail.status])
```

3c. Replace the strip-mode render block (currently `pages.map(...)`) with the multi-chapter flow:

```tsx
{mode === 'strip' ? (
  <div className="flex flex-col items-center gap-1" onClick={handleStripTap}>
    {chapters.map((ch, ci) => (
      <div
        key={ch.number}
        ref={el => { chapterRefs.current[ci] = el }}
        className="w-full flex flex-col items-center gap-1"
      >
        {ci > 0 && (
          <div className="w-full max-w-2xl flex items-center gap-3 py-6 text-xs text-muted">
            <div className="flex-1 border-t border-border" />
            <span>Ch. {chapters[ci - 1].number} selesai · Ch. {ch.number}</span>
            <div className="flex-1 border-t border-border" />
          </div>
        )}
        {ch.pages.map((src, i) => (
          <PageImage key={src} src={src} index={i} eager={i < 3} />
        ))}
      </div>
    ))}

    {tail.status === 'loading' && (
      <div className="py-8 flex justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )}
    {tail.status === 'error' && (
      <div className="py-8 flex flex-col items-center gap-2 text-sm text-muted">
        <span>Gagal memuat Ch. {tail.chapter}</span>
        <button
          onClick={e => { e.stopPropagation(); loadNext() }}
          className="px-4 py-1.5 rounded-full bg-surface-2 text-fg text-xs hover:bg-border transition-colors"
        >
          Coba lagi
        </button>
      </div>
    )}
    {(tail.status === 'last' || tail.status === 'empty') && (
      <div className="py-10 flex flex-col items-center gap-2 text-sm text-muted">
        <span>{tail.status === 'last' ? 'Chapter terakhir' : `Ch. ${tail.chapter} belum tersedia`}</span>
        <Link href={`/manga/${slug}`} className="text-accent text-xs hover:underline" onClick={e => e.stopPropagation()}>
          Kembali ke {mangaName}
        </Link>
      </div>
    )}
    <div ref={sentinelRef} className="h-px w-full" />
  </div>
) : ( /* single mode unchanged in this task */ )}
```

3d. `PageImage` gains an `eager` prop replacing the index heuristic:

```tsx
function PageImage({ src, index, eager }: { src: string; index: number; eager: boolean }) {
  // identical body, but:  loading={eager ? 'eager' : 'lazy'}
}
```

Single-mode `<Image>` and all other single-mode logic keep using `pages`/`pageIndex` untouched in this task (they read `activeChapter.pages` starting Task 5; for now leave the existing `pages` prop usages in single mode as-is).

- [ ] **Step 4: Run tests**

Run: `node node_modules/vitest/vitest.mjs run components/ChapterReader.test.tsx` then the full suite `node node_modules/vitest/vitest.mjs run`
Expected: new tests PASS; existing suite green.

- [ ] **Step 5: Commit**

```bash
git add components/ChapterReader.tsx components/ChapterReader.test.tsx
git commit -m "feat: strip mode auto-appends next chapter via sentinel fetch"
```

---

### Task 5: Boundary tracking — URL, label, history, offline cache, per-chapter progress

**Files:**
- Modify: `components/ChapterReader.tsx`
- Modify: `app/chapter/[slug]/[chapter]/page.tsx` (pass `mangaImage` prop)
- Modify: `docs/superpowers/specs/2026-07-20-auto-next-chapter-design.md` (§4.5 one-line amendment: boundary detection uses the existing scroll handler + `lib/reader` math, not a second IntersectionObserver — same behavior, one mechanism, unit-testable)
- Test: covered by `lib/reader.test.ts` (Task 2) + one wiring assertion added to `components/ChapterReader.test.tsx`

**Interfaces:**
- Consumes: `activeChapterIndex`, `chapterProgress`, `ChapterBounds` from `lib/reader`; `recordHistory` from `lib/storage`; `chapterRefs`, `chapters`, `activeIdx` from Task 4.
- Produces: `mangaImage: string` prop added to `ChapterReader` — the page must pass `data.mangaImage`.

- [ ] **Step 1: Add the wiring test** — append to `components/ChapterReader.test.tsx`:

```tsx
it('records history and updates the URL when a new chapter becomes active', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    chapter: 2, pages: ['https://v7.kiryuu.to/p3.jpg'], prev: 1, next: 3,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  const replaceState = vi.spyOn(window.history, 'replaceState')

  render(<ChapterReader {...baseProps} mangaImage="cover.jpg" />)
  fireSentinel()
  await screen.findByText(/Ch\. 1 selesai · Ch\. 2/)

  // jsdom offsetTop/offsetHeight are 0 — force chapter 2 active by scrolling; the
  // component reads bounds from refs, so stub them:
  const readerDivs = document.querySelectorAll('[data-chapter]')
  Object.defineProperty(readerDivs[0], 'offsetTop', { value: 0 })
  Object.defineProperty(readerDivs[0], 'offsetHeight', { value: 1000 })
  Object.defineProperty(readerDivs[1], 'offsetTop', { value: 1000 })
  Object.defineProperty(readerDivs[1], 'offsetHeight', { value: 1000 })
  window.scrollY = 1200
  fireEvent.scroll(window)

  await waitFor(() => {
    expect(replaceState).toHaveBeenCalledWith(null, '', '/chapter/test-slug/2')
  })
  const history = JSON.parse(localStorage.getItem('mikomi_history') ?? '[]')
  expect(history.some((e: { chapter: number }) => e.chapter === 2)).toBe(true)
})
```

(Requires the chapter wrapper divs from Task 4 to carry `data-chapter={ch.number}` — added in Step 3.)

- [ ] **Step 2: Run to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run components/ChapterReader.test.tsx`
Expected: new test FAILS (no `data-chapter`, no replaceState call).

- [ ] **Step 3: Implement**

3a. Props: add `mangaImage: string` to `ChapterReader` props (type + destructure). In `app/chapter/[slug]/[chapter]/page.tsx`, pass `mangaImage={data.mangaImage}` alongside the existing props. Also add `mangaImage: 'cover.jpg'` to `baseProps` in `components/ChapterReader.test.tsx` so Task 4's tests keep type-checking once the prop is required.

3b. Add `data-chapter={ch.number}` to the per-chapter wrapper div from Task 4.

3c. Replace the strip branch of the progress effect with combined boundary + progress tracking:

```tsx
import { activeChapterIndex, chapterProgress } from '@/lib/reader'

const recordedRef = useRef<Set<number>>(new Set([chapter]))

useEffect(() => {
  if (mode === 'single') {
    setProgress(activeChapter.pages.length > 0 ? ((pageIndex + 1) / activeChapter.pages.length) * 100 : 0)
    return
  }
  function handleScroll() {
    const bounds = chapterRefs.current
      .filter((el): el is HTMLDivElement => el !== null)
      .map(el => ({ top: el.offsetTop, height: el.offsetHeight }))
    if (bounds.length === 0) return
    const idx = activeChapterIndex(bounds, window.scrollY, window.innerHeight)
    setProgress(chapterProgress(bounds[idx], window.scrollY, window.innerHeight))
    setActiveIdx(idx)
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
  return () => window.removeEventListener('scroll', handleScroll)
}, [mode, pageIndex, chapters.length, activeChapter.pages.length])
```

3d. React to active-chapter changes (new effect):

```tsx
useEffect(() => {
  const ch = chapters[activeIdx]
  if (!ch) return
  window.history.replaceState(null, '', `/chapter/${slug}/${ch.number}`)
  if (!recordedRef.current.has(ch.number)) {
    recordedRef.current.add(ch.number)
    recordHistory({ slug, chapter: ch.number, mangaName, mangaImage })
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'CACHE_CHAPTER',
          urls: ch.pages,
          chapterUrl: `/chapter/${slug}/${ch.number}`,
          apiUrl:     `/api/chapter/${slug}/${ch.number}`,
        })
      }).catch(() => {})
    }
  }
}, [activeIdx, chapters, slug, mangaName, mangaImage])
```

3e. Top bar label becomes `Ch. {activeChapter.number}`; bottom-nav prev/next links read `activeChapter.prev` / `activeChapter.next` instead of the props; bottom-nav page-count span reads `activeChapter.pages.length`.

3f. Spec amendment (one line in §4.5): replace the "second IntersectionObserver (threshold tuned…)" sentence with "observed by the existing scroll handler using `activeChapterIndex`/`chapterProgress` from `lib/reader` (same midline rule, one mechanism, unit-testable)".

- [ ] **Step 4: Run tests**

Run: `node node_modules/vitest/vitest.mjs run`
Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ChapterReader.tsx components/ChapterReader.test.tsx "app/chapter/[slug]/[chapter]/page.tsx" docs/superpowers/specs/2026-07-20-auto-next-chapter-design.md
git commit -m "feat: URL, history, offline cache, and progress follow the active chapter"
```

---

### Task 6: Mode-toggle collapse + single-mode next-chapter navigation

**Files:**
- Modify: `components/ChapterReader.tsx`
- Test (modify): `components/ChapterReader.test.tsx`

**Interfaces:**
- Consumes: `useRouter` from `next/navigation` (already mocked in the test file); `chapters`, `activeIdx`, `activeChapter`, `tail` from Tasks 4–5.
- Produces: none consumed later — final reader behavior.

- [ ] **Step 1: Write the failing test** — append to `components/ChapterReader.test.tsx`; also lift the router mock so the test can assert on it:

```tsx
// replace the existing next/navigation mock at the top of the file with:
const routerPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }))
```

```tsx
it('single mode: next tap on the last page navigates to the next chapter', async () => {
  vi.stubGlobal('fetch', vi.fn())
  localStorage.setItem('mikomi_reading_mode', JSON.stringify('single'))
  render(<ChapterReader {...baseProps} mangaImage="cover.jpg" />)

  const nextZone = await screen.findByRole('button', { name: /next page/i })
  fireEvent.click(nextZone) // page 1 -> 2 (last page)
  fireEvent.click(nextZone) // last page -> next chapter
  expect(routerPush).toHaveBeenCalledWith('/chapter/test-slug/2')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run components/ChapterReader.test.tsx`
Expected: new test FAILS — `routerPush` never called (current `goNext` does nothing on the last page).

- [ ] **Step 3: Implement**

3a. Import and instantiate the router: `import { useRouter } from 'next/navigation'` and `const router = useRouter()` at the top of the component.

3b. Single mode reads the active chapter everywhere it used `pages`: `activeChapter.pages[pageIndex]`, `activeChapter.pages.length` (render, tap zones, counter, progress effect — the progress effect already does this after Task 5).

3c. `goNext` navigates past the last page:

```tsx
const goNext = useCallback(() => {
  if (mode !== 'single') return
  if (pageIndex < activeChapter.pages.length - 1) {
    setPageIndex(p => p + 1)
    setSingleLoaded(false)
  } else if (activeChapter.next !== null) {
    router.push(`/chapter/${slug}/${activeChapter.next}`)
  }
}, [mode, pageIndex, activeChapter, router, slug])
```

3d. The right tap-zone chevron also renders on the last page when `activeChapter.next !== null` (change its condition from `pageIndex < pages.length - 1` to `pageIndex < activeChapter.pages.length - 1 || activeChapter.next !== null`).

3e. `toggleMode` collapses to the active chapter:

```tsx
function toggleMode() {
  const nextMode = mode === 'strip' ? 'single' : 'strip'
  const current = chapters[activeIdx] ?? chapters[0]
  setChapters([current])
  setActiveIdx(0)
  setTail(current.next === null ? { status: 'last' } : { status: 'idle' })
  recordedRef.current = new Set([current.number])
  setMode(nextMode)
  setPageIndex(0)
  setProgress(0)
  setSingleLoaded(false)
  writeStorage(STORAGE_KEYS.readingMode, nextMode)
}
```

- [ ] **Step 4: Run tests + build**

Run: `node node_modules/vitest/vitest.mjs run` then `node node_modules/next/dist/bin/next build`
Expected: suite PASS, build clean (no TS errors).

- [ ] **Step 5: Commit**

```bash
git add components/ChapterReader.tsx components/ChapterReader.test.tsx
git commit -m "feat: mode toggle collapses to active chapter; single mode last page advances chapter"
```

---

### Task 7: Push, preview verification, hand off promote

**Files:** none (verification only)

- [ ] **Step 1: Push the branch**

```bash
git push
```

- [ ] **Step 2: Wait for the Vercel preview build** (GitHub commit status turns `success`; poll `https://api.github.com/repos/pambayungiri/mikomi/commits/<sha>/status`).

- [ ] **Step 3: Manual verification on the preview** (`https://mikomi-git-fix-kiryuu-v7-hosts-pambayungiris-projects.vercel.app`):
  - Open `/chapter/<teisou long slug>/9.1`, scroll to the end → 9.2 appends after a divider with no visible load; URL bar reads `/9.2` once it fills the screen.
  - Continue to 9.3 → 10; at the final chapter the "Chapter terakhir" divider appears.
  - Toggle to single mode mid-chapter → only the active chapter remains; tap through to the last page → tap next → navigates to the next chapter.
  - Check `/history` page lists each chapter reached.
  - curl the API: `/api/chapter/<slug>/9.1` returns `{ chapter: 9.1, pages: [...], prev, next }`.

- [ ] **Step 4: Report + hand off** — production promote requires the user to run `vercel promote <new-dpl-id> --scope pambayungiris-projects --yes` (permission classifier blocks the assistant unless the user asks in-turn).
