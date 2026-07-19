import { describe, it, expect, beforeEach } from 'vitest'
import { readStorage, writeStorage, STORAGE_KEYS, recordHistory, type HistoryEntry } from './storage'

describe('STORAGE_KEYS', () => {
  it('has all expected keys', () => {
    expect(STORAGE_KEYS.bookmarks).toBe('mikomi_bookmarks')
    expect(STORAGE_KEYS.history).toBe('mikomi_history')
    expect(STORAGE_KEYS.readingMode).toBe('mikomi_reading_mode')
    expect(STORAGE_KEYS.offline).toBe('mikomi_offline')
    expect(STORAGE_KEYS.recentSearches).toBe('mikomi_recent_searches')
  })
})

describe('readStorage', () => {
  beforeEach(() => localStorage.clear())

  it('returns fallback when key is absent', () => {
    expect(readStorage('missing', [])).toEqual([])
  })

  it('returns parsed value when key exists', () => {
    localStorage.setItem('test-key', JSON.stringify({ a: 1 }))
    expect(readStorage('test-key', null)).toEqual({ a: 1 })
  })

  it('returns fallback when JSON is corrupted', () => {
    localStorage.setItem('bad', 'not{{json')
    expect(readStorage('bad', 'default')).toBe('default')
  })

  it('returns fallback when stored value is JSON null', () => {
    localStorage.setItem('nullval', 'null')
    expect(readStorage('nullval', 'fallback')).toBe('fallback')
  })
})

describe('writeStorage', () => {
  beforeEach(() => localStorage.clear())

  it('writes serialized value', () => {
    writeStorage('k', [1, 2, 3])
    expect(localStorage.getItem('k')).toBe('[1,2,3]')
  })

  it('overwrites existing value', () => {
    writeStorage('k', 'old')
    writeStorage('k', 'new')
    expect(localStorage.getItem('k')).toBe('"new"')
  })
})

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
