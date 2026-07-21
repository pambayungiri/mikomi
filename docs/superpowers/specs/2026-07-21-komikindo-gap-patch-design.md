# Komikindo Gap-Patch — Design Spec

> Dibuat: 21 Juli 2026
> Status: approved design, pending implementation plan

## 1. Goal

Kiryuu is the sole, authoritative manga source for Mikomi. A full-catalog audit (2026-07-21) found 554 titles with a real, confirmed gap in Kiryuu's own chapter run, plus 703 titles with zero chapters found on Kiryuu at all. Nothing about that is a bug — those chapters simply aren't on Kiryuu.

This feature patches specific, individually-verified missing chapters in from `komikindo.ch` — never as a full second source, only to fill a hole Kiryuu already has. Kiryuu's own chapters are never overridden, re-ordered, or second-guessed. If a title has no gap, komikindo is never consulted for it at all.

## 2. Background — why this is a patch, not a second provider

- **komikindo.ch has no chapter-list API.** Its `manga` post type carries no chapter data, and full-text search against `/wp-json/wp/v2/posts` only ever surfaces a manga's own info page, never its chapters. Chapters are only reachable by guessing an exact slug (`{manga-slug}-chapter-{N}`) and checking whether a post exists at it — there's no way to ask "what does this manga have" the way Kiryuu's `/chapter?search=` does.
- **This is actually good news for scope.** The audit already knows the exact missing chapter numbers per title, so nothing needs discovering — each (title, missing-number) pair is a single targeted probe, not a crawl.
- **komikindo's own slugs can't be trusted blindly.** Manga slugs are inconsistent (`155895-nano-machine` vs `solo-leveling-ragnarok` — some carry a numeric ID prefix, some don't), and there's every reason to expect the same category of chapter-labeling bugs this whole session found and fixed on Kiryuu (mislabeled bundles, dropped decimals, wrong numbers). A found post is a candidate, not a confirmed fact.
- **Verified with real data before designing further:** sampled 5 specific missing (title, chapter) pairs from the audit directly against komikindo — 2 confirmed present with real, loadable page images (Shura Sword Sovereign ch.197 — 26 pages; Kamonohashi Ron no Kindan Suiri ch.2), 3 not found. Roughly half of what's missing on Kiryuu turns up on komikindo — a real but partial win, matching the "clean up the gap, nothing else" framing.

## 3. Decisions (user-confirmed)

1. **Curated static patch list**, not a live/dynamic merge. All matching, probing, and verification happens offline in a maintenance script; the running app only ever does a lookup into pre-verified data plus a live page-content fetch for chapters already confirmed to exist.
2. **Two verification gates**, both required before a candidate enters the patch list:
   - **Title cross-check**: the found post's own title text must state the exact chapter number requested (same style of check as Kiryuu's `numberFromChapterTitle` — no reconciliation, no guessing, exact match only).
   - **Page-count sanity check**: the candidate's page count must fall within 30%-300% of a baseline average — Kiryuu's own average page count for that title's other chapters when Kiryuu has any, otherwise the average of a few of komikindo's own neighboring chapters for that same title. Outside that band, exclude rather than guess.
3. **Never overrides Kiryuu.** A patch entry is only ever added for a chapter number Kiryuu's own list does not already have. If Kiryuu later posts a chapter that used to be patched, Kiryuu's version wins on the next patch-list regeneration (regeneration should skip any number Kiryuu now has).
4. **No visible "alternate source" indicator in the reader.** Patched chapters appear as ordinary chapters in the list and reader — consistent with how this session's HD/LQ-quality dedup and combined-range reconciliation were also silent, seamless corrections. (Open to revisiting if this turns out to matter later — noted as a decision, not a constraint.)
5. **Pilot small first.** Ship the pipeline and integration against a hand-picked, already-verified starter batch (the samples already confirmed working during this design conversation), then decide whether to run the generator against the full 554+703 list.

## 4. Architecture

### 4.1 Runtime piece — `lib/providers/komikindo.ts`

Small and narrow — the running app never searches or matches on komikindo, it only fetches page content for a chapter slug already known good:

```ts
export async function fetchKomikindoChapterPages(chapterSlug: string): Promise<string[]>
```

Implementation: `GET /wp-json/wp/v2/posts?slug={chapterSlug}&_fields=id` to resolve the post ID, then `GET /wp-json/apk/v2/chapter/{id}` and return its `image` array. Returns `[]` on any failure (missing post, network error, empty `image` array) — the caller treats that the same as "chapter not found," never a crash.

### 4.2 Patch data — `lib/providers/komikindo-patches.json` + `lib/providers/patch-data.ts`

Data file shape (kept lean — no image URLs stored, those go stale; only enough to locate the chapter live):

```json
{
  "shura-sword-sovereign": { "197": "shura-sword-sovereign-chapter-197" },
  "kamonohashi-ron-no-kindan-suiri": { "2": "kamonohashi-ron-no-kindan-suiri-chapter-2" }
}
```

Loader module:

```ts
export function getPatchedChapterSlug(mangaSlug: string, chapterNumber: number): string | null
```

Pure, synchronous, no network — a plain object lookup.

### 4.3 Integration into `lib/providers/kiryuu.ts`

The internal-only `ChapterMetaWithSlug` type (already used inside this file, never exposed via `MangaProvider`) gains one optional field:

```ts
type ChapterMetaWithSlug = ChapterMeta & { slug: string; source?: 'komikindo' }
```

- **`getManga(slug)`**: after building the normal chapter list from Kiryuu's own data, look up patch entries for `slug` and add any whose chapter number isn't already present in the list — each added as `{ number, updatedAt: '', note: '', slug: komikindoChapterSlug, source: 'komikindo' }` — then re-sort (existing desc-by-number sort).
- **`getChapter(slug, chapter)`**: unchanged resolution against the (now-merged) chapter list for `prev`/`next`. Only the page-fetch step branches on `source`: a plain entry fetches content from Kiryuu exactly as today; a `source: 'komikindo'` entry calls `fetchKomikindoChapterPages(target.slug)` instead — `target.slug` is the komikindo chapter slug in that case, not a Kiryuu one, so it must never be passed to Kiryuu's own content-fetch URL.

No changes to `MangaProvider`, the exported `ChapterMeta`, or `ChapterDetail` — `source` exists only on the internal type and never leaves `KiryuuProvider`.

### 4.4 Maintenance script — `scripts/build-komikindo-patches.mjs`

Offline, run manually (not part of the request path, not part of the Next.js build). For each title in the audit's missing/no-data lists:

1. Resolve the manga's komikindo slug via `GET /wp-json/wp/v2/manga?search={title}` (title-text match).
2. Build the list of chapter numbers to probe — this differs by which audit bucket the title came from, since only one of them has a known gap list:
   - **554 "genuinely missing" titles**: probe exactly the audit's own gap numbers (integers only — the audit's gap output is always integer floors). Nothing to discover, the numbers are already known.
   - **703 "no chapter data at all" titles**: there's no existing gap list to work from (Kiryuu has zero chapters, so there's no continuity data to compute one). Probe ascending from 1, stopping after 5 consecutive not-found results or at 500 (whichever comes first) — bounds the cost per title while still discovering what komikindo actually has.
3. For each number found, probe `GET /wp-json/wp/v2/posts?slug={komikindo-slug}-chapter-{N}`.
4. If found, apply both verification gates from decision 2 in §3 (title cross-check, then page-count sanity check).
5. Passing candidates are written to `komikindo-patches.json`; failing candidates are logged (title, number, reason) for visibility but not included.

Re-running the script is always safe — it fully regenerates the patch file from scratch each time, so it never accumulates stale entries.

## 5. Error handling

- komikindo being unreachable, slow, or having removed a previously-patched chapter must never break a manga page or the rest of its chapter list — `fetchKomikindoChapterPages` returning `[]` results in that one chapter being unavailable, exactly like a 404 on any other chapter today.
- The patch file is static between regenerations, so drift (komikindo removes content after being patched in) is possible but self-healing on the next regeneration and non-fatal in the meantime (worst case: one patched chapter starts 404ing, same failure mode as any other missing chapter).

## 6. Testing

Follows this repo's existing pattern (`vi.stubGlobal('fetch', ...)`, no real network in tests):

- `lib/providers/komikindo.test.ts`: `fetchKomikindoChapterPages` — resolves a real post ID then returns its images; returns `[]` when the slug isn't found; returns `[]` on a fetch failure.
- `lib/providers/patch-data.test.ts`: `getPatchedChapterSlug` — returns the mapped slug for a known (manga, chapter) pair; returns `null` for anything not in the table.
- `lib/providers/kiryuu.test.ts` additions: `getManga` merges a patch entry into the chapter list without disturbing existing Kiryuu chapters; `getManga` does NOT add a patch entry for a number Kiryuu already has; `getChapter` serves a patched chapter's pages via `fetchKomikindoChapterPages` and still resolves correct `prev`/`next` against the merged list.

The maintenance script itself is not unit-tested (it's a one-off batch tool, same category as this session's scratchpad audit scripts) but should be runnable end-to-end against a small manual sample before the first real run.

## 7. Rollout

1. Build `komikindo.ts`, `patch-data.ts`, the `kiryuu.ts` merge points, and their tests (TDD, per this repo's standing discipline).
2. Seed `komikindo-patches.json` by hand with the pairs already confirmed during this design conversation (Shura Sword Sovereign ch.197, Kamonohashi Ron no Kindan Suiri ch.2) — enough to verify the integration works end-to-end on real, known-good data before trusting the generator script's judgment at scale.
3. Build and run `build-komikindo-patches.mjs` against the full 554+703 list, review the excluded/rejected log for anything surprising, then let it replace the hand-seeded file.
4. No production promotion decision is made by this spec — deploy following the same preview-then-explicit-promote flow already used throughout this session.

## 8. Explicitly out of scope

- Any source other than komikindo.ch.
- Any UI change surfacing "this chapter is from an alternate source."
- Filling gaps live/dynamically at request time — everything is pre-verified and static between script runs.
- Re-attempting the 3 sampled misses (chapters not found on komikindo at all) through any other means — if komikindo doesn't have it, the gap stays a gap.
