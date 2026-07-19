# Auto-Load Next Chapter on Scroll — Design Spec

> Dibuat: 20 Juli 2026
> Status: approved design, pending implementation plan

## 1. Goal

When the reader scrolls to the end of a chapter in strip mode, the next chapter loads and appends seamlessly — no tap, no page navigation, no visible wait on a normal connection. The URL, top-bar label, reading history, and offline cache all follow the chapter the user is actually reading.

## 2. References

| Reader | Behavior | Takeaway |
|---|---|---|
| Tachiyomi / Suwayomi (continuous vertical) | Auto-append with a chapter-transition divider, preloads ahead | The UX benchmark |
| komiku.org | jQuery infinite-ajax-scroll: fetches next chapter's full HTML at 200px from bottom, appends, never updates URL | Familiar pattern for our users; we improve on trigger distance, payload size, and URL handling |
| MangaDex + infinite-scroll userscript | Not native; bolted on by users | Demand validation |

Technical pattern: IntersectionObserver sentinel with large `rootMargin` (no scroll polling), `history.replaceState` on chapter boundary crossing.

## 3. Decisions (user-confirmed)

1. **Seamless auto-append** in strip mode (no tap-to-continue, no toggle).
2. **URL follows the reader**: `history.replaceState` to `/chapter/<slug>/<n>` when a chapter fills most of the viewport; reading history records each chapter reached.
3. **Single-page mode also improves**: on the last page, the "next" tap zone and ArrowRight navigate to the next chapter (`router.push`) instead of doing nothing.

## 4. Architecture

### 4.1 API route extension — `app/api/chapter/[slug]/[num]/route.ts`

Current: `parseInt(num)` and returns `{ pages }`.

Changes:
- `parseFloat(num)` — `parseInt` truncates sub-chapters ("9.1" → 9), which today silently serves the wrong chapter to offline-save; this fix is required for chaining and fixes that latent bug.
- Response becomes `{ chapter, pages, prev, next }` — the provider's `getChapter` already computes `prev`/`next`; the route currently discards them. Keeping `pages` means the existing service-worker offline consumer is unaffected.

Each fetched chapter response tells the reader what comes after it, so chaining continues indefinitely without extra metadata requests.

### 4.2 Reader state — `components/ChapterReader.tsx`

State changes from a single `pages: string[]` to:

```ts
type LoadedChapter = { number: number; pages: string[]; next: number | null }
const [chapters, setChapters] = useState<LoadedChapter[]>([seedFromProps])
const [activeIdx, setActiveIdx] = useState(0)          // which chapter fills the viewport
const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
```

The SSR'd first chapter seeds the array. `activeIdx` drives the top-bar "Ch. X" label, the progress bar, the bottom-nav prev/next targets, URL, and history writes.

### 4.3 Sentinel — fetching the next chapter

- A `<div ref={sentinelRef} />` sits after the last rendered page.
- IntersectionObserver with `rootMargin: '1500px 0px'` — fetch begins ~3–5 pages before the end.
- On intersect (and `loadState === 'idle'`, last chapter's `next !== null`): fetch `/api/chapter/<slug>/<next>`, append `LoadedChapter`, back to `idle`.
- Guard against double-fires with `loadState` (no fetch while `loading`).
- Failure → `loadState = 'error'`: divider renders a "Gagal memuat Ch. X — Coba lagi" button; tap retries. No automatic retry loop.
- `next === null` → `loadState = 'done'`: end divider "Chapter terakhir" + link back to `/manga/<slug>`.
- First 3 images of an appended chapter use `loading="eager"` (same warm-up the first chapter gets).

### 4.4 Chapter dividers

Between chapter N and N+1, a full-width slim divider in existing muted styling:

```
─────────  Ch. 9.1 selesai · Ch. 9.2  ─────────
```

While `loading` and the user is near the sentinel, the divider slot shows a small spinner row. Divider is part of the strip flow (scrolls with content).

### 4.5 Boundary tracking — URL, label, history, offline cache

- Each chapter's container registers in a second IntersectionObserver (threshold tuned so a chapter counts as "active" when it crosses the middle of the viewport).
- On active chapter change:
  - `history.replaceState(null, '', '/chapter/<slug>/<n>')` — no reload, back button unaffected.
  - Top bar label and bottom-nav prev/next update from the active chapter's data.
  - Reading-history write (same storage write `HistoryTracker` does) — once per chapter per session.
  - SW `CACHE_CHAPTER` postMessage fires for the newly active chapter (mirrors current per-page-load behavior).
- `HistoryTracker` keeps handling the initial chapter; the reader handles appended ones. The storage write is extracted to a shared helper in `lib/storage.ts` so both use one code path.

### 4.6 Progress bar

Changes from whole-document % to **per-active-chapter %**: computed from the active chapter container's `offsetTop`/`offsetHeight` vs scroll position. Without this, each append visibly yanks the bar backwards.

### 4.7 Mode toggle interaction

Toggling strip → single collapses to the currently **active** chapter: `chapters = [chapters[activeIdx]]`, `pageIndex = 0`. Single → strip keeps the current chapter as the sole loaded chapter and resumes appending from there. This keeps single-page mode's mental model (one chapter at a time) intact.

### 4.8 Single-page mode next-chapter navigation

On the last page, the right tap zone and ArrowRight call `router.push('/chapter/<slug>/<next>')` when `next !== null`. The tap-zone chevron renders on the last page too (pointing to the next chapter) instead of disappearing.

## 5. Edge cases

| Case | Behavior |
|---|---|
| Next chapter has 0 pages (DMCA/empty upload) | Treat as end-of-line: divider shows "Ch. X belum tersedia" + link to manga page. Do not chain past it. |
| Fetch fails (network/Kiryuu 403) | Error divider with manual retry; no auto-retry |
| Decimal chapters (9.1 → 9.2) | Works via parseFloat + provider's list-based `next` |
| Very long sessions (10+ chapters) | No virtualization (YAGNI). DOM grows; acceptable for realistic sessions. Revisit only if reports appear. |
| User in single mode | No auto-append; only last-page navigation |
| Zoomed viewport (iOS pinch) | Sentinel/boundary observers unaffected; existing bottom-nav hide behavior unchanged |

## 6. Testing

- **Unit (vitest)**: API route returns `{ chapter, pages, prev, next }` and handles "9.1"; active-chapter math (given container bounds + scroll offset → active index, progress %) extracted as a pure helper and tested.
- **Component (@testing-library/react)**: stub `fetch` + IntersectionObserver; assert sentinel intersect → fetch called with next chapter URL → appended pages render after a divider; error path renders retry button; retry re-fetches.
- **Manual/preview**: teisou sub-chapter run (9.1 → 9.2 → 9.3 → 10) on the Vercel preview before promote.

## 7. Out of scope

- Auto-append in single-page mode
- Prefetching more than one chapter ahead
- Virtualized/windowed DOM
- Any provider-side changes beyond the API route (provider already supplies prev/next)
