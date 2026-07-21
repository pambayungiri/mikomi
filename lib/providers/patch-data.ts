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
