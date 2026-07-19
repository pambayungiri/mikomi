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
