import emptySlugs from './empty-manga.json'

const emptySet = new Set<string>(emptySlugs)

// Confirmed via the 2026-07-21 full-catalog audit plus the komikindo gap-patch
// run: these titles have zero readable chapters on Kiryuu, and komikindo has
// nothing for them either. Filtering them out of every list/search surface
// avoids a reader clicking into a manga page with nothing to read. This is a
// static snapshot — Kiryuu could post a first chapter for one of these later,
// re-running the audit is what would pick that up, not a live check here.
export function isKnownEmpty(slug: string): boolean {
  return emptySet.has(slug)
}
