export const STORAGE_KEYS = {
  bookmarks:      'mikomi_bookmarks',
  history:        'mikomi_history',
  readingMode:    'mikomi_reading_mode',
  offline:        'mikomi_offline',
  recentSearches: 'mikomi_recent_searches',
} as const

export type BookmarkEntry = {
  slug: string
  name: string
  image: string
  type: string
  latestChapter: number | null
}

export type HistoryEntry = {
  slug: string
  chapter: number
  mangaName: string
  mangaImage: string
  timestamp: number
}

export type OfflineEntry = { slug: string; chapter: number }

export function readStorage<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore quota errors */ }
}

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
