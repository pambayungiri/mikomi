# Mikomi Quality Improvements Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Fix all issues found in the June 2026 quality audit — covering correctness, SEO, accessibility, UX, performance, and UI polish.

**Audit method:** Playwright automated audit on local build + manual code review.

**Scope:** 13 issues across 6 categories. No new features — fixes only.

---

## Issues by Category

### A. Correctness & SEO (HIGH)

**A1 — Wrong HTML language attribute**
- File: `app/layout.tsx` line 53
- Current: `<html lang="en">`
- Fix: `<html lang="id">` — site content is Indonesian
- Impact: Screen readers announce wrong language; Google may deprioritize for Indonesian queries

**A2 — No `<h1>` on homepage**
- File: `app/page.tsx`
- Current: Page renders with `<h2>` section headers but no `<h1>`
- Fix: Add a visually-hidden `<h1>` — "Baca Manga, Manhwa, Manhua — Mikomi" — above the HeroCarousel using Tailwind `sr-only`. Do not add visible h1 as it would disrupt the carousel layout.
- Impact: SEO + screen reader users have no page landmark

**A3 — Image crash on empty cover URL**
- File: `lib/proxy.ts` and `components/MangaCard.tsx`
- Current: `proxyUrl('')` returns `''`; `<Image src="">` throws/shows broken image
- Fix: `proxyUrl` returns `/placeholder-cover.jpg` when url is empty. Create `public/placeholder-cover.jpg` — a 400×600 solid `#1c1c26` JPEG ≤5KB (no text, no logo — simple dark placeholder matching the app's `surface-2` color).
- Impact: Any manga without a cover art on MangaDex crashes the card

**A4 — No error boundary on homepage**
- File: `app/page.tsx`
- Current: All 6 `provider.*` calls in `Promise.all`. If any throws, the entire page 500s.
- Fix: Wrap each section in individual `try/catch` inside the server component, returning `null` on failure. This way a single MangaDex API failure only hides that section, not the whole page.
- Impact: Production resilience — MangaDex API is intermittent

---

### B. Performance (MEDIUM)

**B1 — No Suspense streaming on homepage**
- File: `app/page.tsx`
- Current: `await Promise.all([...6 calls...])` — page doesn't stream until all 6 complete
- Fix: Split homepage into async server component sections, each wrapped in `<Suspense fallback={<HorizontalSkeleton />}>`. Sections: Hero, LatestUpdate, TopManga, TopManhwa, TopManhua, NewArrivals. Each fetches independently and streams as ready.
- New component: `components/HorizontalSkeleton.tsx` — 6 shimmer card placeholders

---

### C. UX (MEDIUM)

**C1 — 21 tap targets below 44px minimum**
- Affected elements:
  1. Logo link in `Nav` — `<Image width={28} height={28}>` wrapped in `<Link>` — link height is 28px
  2. Bottom nav items (Home, Favorite, Saved, History) — `h-14` container but label+icon layout is fine; issue is the icon-only items
  3. Mode toggle button in ChapterReader — `px-3 py-1.5` ≈ 30px height
- Fix per element:
  - Nav logo link: add `py-3` to the `<Link>` to expand touch area, or use `min-h-[44px]` on the link wrapper
  - Bottom nav: already `h-14` (56px) — the issue is sub-elements. The outer `<Link>` is already full height, so this may be a false positive from the audit. Verify and skip if already correct.
  - Mode toggle: change `py-1.5` to `py-2.5` to reach 44px height

**C2 — "0 Chapters" shown without explanation**
- File: `app/manga/[slug]/page.tsx` around line 198
- Current: `<h2>{manga.chapters.length} Chapters</h2>` — shows "0 Chapters" with empty list
- Fix: When `manga.chapters.length === 0`, show:
  ```
  <p className="text-muted text-sm mt-2">
    Belum ada chapter bahasa Indonesia atau Inggris yang tersedia di MangaDex.
  </p>
  ```
  And hide the "Start Reading" / "Latest Chapter" buttons (already conditional on `manga.chapters.length > 0` ✅).

---

### D. UI Polish (LOW)

**D1 — Bottom nav Browse button has no text label**
- File: `components/BottomNav.tsx`
- Current: The "Browse" (prominent) button renders only icon inside a rounded square, no text label below it (unlike other items which have text)
- Fix: Add `<span className="text-[10px] font-medium mt-0.5">Browse</span>` below the icon div for the prominent item

**D2 — No section variety on homepage**
- File: `app/page.tsx`
- Current: "Latest Update" and "Popular" carousel look identical — same horizontal scroll layout
- Fix: "Popular" manga is already in HeroCarousel ✅. "New Arrivals" already uses grid layout ✅. Layout is actually varied. No change needed — was a false observation.

**D3 — Genre tags not visible for some manga**
- File: `app/manga/[slug]/page.tsx` around line 159-168
- Current: Genre tags only render if `manga.genre.length > 0`. If MangaDex doesn't tag a manga, no tags show.
- Fix: Also render `manga.themes` and `manga.demographic` tags with different styling so there's always at least some metadata visible.
  - Genre tags: `bg-surface-2 text-muted` (current)
  - Theme tags: `bg-surface-2 text-accent/70` (slightly different)  
  - Demographic tag: `bg-accent/10 text-accent` (distinct)

---

### E. Accessibility (LOW)

**E1 — Skip link is 1×1px (not accessible)**
- File: `app/layout.tsx` line 61-67
- Current: `<a href="#main-content" className="sr-only focus:not-sr-only ...">` — `sr-only` collapses to 1px which the audit picked up as < 44px tap target
- Fix: This is correct behavior — skip links are intentionally hidden until focused. No change needed; audit was a false positive.

---

## Files to Create

- `public/placeholder-cover.jpg` — 400×600px dark grey placeholder image
- `components/HorizontalSkeleton.tsx` — shimmer placeholder for horizontal scroll sections
- `components/HomepageSection.tsx` — async server component wrapper with built-in Suspense + error boundary per section

## Files to Modify

| File | Changes |
|------|---------|
| `app/layout.tsx` | `lang="en"` → `lang="id"` |
| `app/page.tsx` | Add sr-only h1; split into async sections with Suspense; individual try/catch per section |
| `lib/proxy.ts` | Return `/placeholder-cover.jpg` when url is empty |
| `components/MangaCard.tsx` | No change needed (proxyUrl handles fallback) |
| `components/HeroCarousel.tsx` | No change needed |
| `components/BottomNav.tsx` | Add text label to prominent Browse button |
| `components/ChapterReader.tsx` | Increase mode toggle py to reach 44px |
| `app/manga/[slug]/page.tsx` | Add "no chapters" message (with DMCA explanation); show theme + demographic tags |
| `lib/providers/mangadex.ts` | Change `getTopRatedByType` sort from `order[rating]=desc` → `order[followedCount]=desc` |
| `app/page.tsx` | Rename "Top Rated" section headers to "Popular"; update `href` sort params |

---

### F. Content Accuracy (HIGH)

**F1 — Famous manga show "0 Chapters" (DMCA/licensing stale flag)**
- **Root cause (confirmed via API):** When manga publishers (Shueisha, Viz, etc.) issue DMCA takedowns, MangaDex removes the chapter content but keeps the manga metadata entry. Crucially, the `hasAvailableChapters=true` flag is NOT recalculated after removal — it stays `true` from when chapters were originally uploaded. This means One Piece, Naruto, Hunter x Hunter, Frieren, and others appear in browse/search results (stale flag says chapters exist) but the detail page shows 0 chapters (actual feed is empty).
- **Evidence:** `GET /manga/{onePieceUuid}/feed` with no language or content-rating filter returns `total=0`.
- **Scope:** We cannot fix MangaDex's stale flags. We CAN fix the user-facing message.
- **Fix — update C2 message:** Change the 0-chapters message to explain the likely cause:
  ```
  <p className="text-muted text-sm mt-2">
    Chapter tidak tersedia di MangaDex. Judul ini mungkin telah dihapus karena lisensi resmi
    (seperti Shonen Jump / Viz). Coba baca di platform resmi.
  </p>
  ```
  No code changes elsewhere — the spec item C2 already covers this, just update the copy.

**F2 — "Top Rated" sections show obscure unknown manga (broken rating sort)**
- **Root cause (confirmed via API):** MangaDex `order[rating]=desc` sorts by simple average — manga with 5 ratings of 10/10 rank above manga with 100,000 ratings of 9.5/10. There is no bayesian weighting. Additionally, MangaDex has removed the `rating` field from list API responses entirely (every result returns `rating: undefined` in June 2026), so the ordering is essentially arbitrary from a user perspective.
- **Evidence:** `order[rating]=desc` for Manhwa returns "Eomma re Mannareo Ganeun Gil", "Yeokdaegeum Yeongji Seolgyesa", etc. — completely unknown titles. The same query with `order[followedCount]=desc` returns **Solo Leveling (#1)**, Omniscient Reader, A Returner's Magic — exactly what users expect.
- **Fix:** Change `getTopRatedByType` in `lib/providers/mangadex.ts` from `order[rating]: 'desc'` → `order[followedCount]: 'desc'`. This makes per-type sections show the most followed (genuinely popular) titles per language origin:
  - Manga (Japanese): My Dress-Up Darling, Shadow Garden, Tensei Slime, Frieren, Chainsaw Man
  - Manhwa (Korean): **Solo Leveling**, Omniscient Reader, A Returner's Magic
  - Manhua (Chinese): Known titles in the space
- **Why not a duplicate of `getPopular()`:** `getPopular()` fetches across ALL types with no language filter → used for HeroCarousel (mixed). `getTopRatedByType` with `followedCount` filters by `originalLanguage[]=ko/ja/zh` → shows type-specific popular titles. Different set of results.
- **Rename sections:** Update homepage labels from "Top Rated Manga/Manhwa/Manhua" → "Popular Manga/Popular Manhwa/Popular Manhua" to be accurate. Update `href` links from `?sort=rating` → `?sort=popular` (or keep as `followedCount` internally).
- **Files:** `lib/providers/mangadex.ts` line 309, `app/page.tsx` lines 72-74

---

## Global Constraints

- No new dependencies
- Tailwind v4 only — no arbitrary CSS unless no Tailwind equivalent
- All text labels in Indonesian/English matching existing convention
- ISR revalidation times unchanged
- No changes to MangaDex provider logic
- TypeScript strict — no `any`, no `@ts-ignore`
- Placeholder image must be ≤ 5KB (simple solid color)
