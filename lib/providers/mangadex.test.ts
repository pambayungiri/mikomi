import { describe, it, expect } from 'vitest'
import { slugify } from './mangadex-slug'

// Test the pure helper functions that will be exported from mangadex.ts
// We import them after implementation — for now this file just defines what we expect

describe('slugify (sanity check from mangadex-slug)', () => {
  it('works', () => expect(slugify('Test Manga')).toBe('test-manga'))
})

// These tests use the internal helpers once exported:
describe('originType', () => {
  it('maps ko to Manhwa', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('ko')).toBe('Manhwa')
  })
  it('maps zh to Manhua', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('zh')).toBe('Manhua')
  })
  it('maps zh-hk to Manhua', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('zh-hk')).toBe('Manhua')
  })
  it('maps ja to Manga', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('ja')).toBe('Manga')
  })
  it('defaults unknown to Manga', async () => {
    const { originType } = await import('./mangadex')
    expect(originType('fr')).toBe('Manga')
  })
})

describe('deduplicateChapters', () => {
  it('keeps the chapter with more pages when two groups translate same number', async () => {
    const { deduplicateChapters } = await import('./mangadex')
    const input = [
      { id: 'ch-a', attributes: { chapter: '1', translatedLanguage: 'id', pages: 20, updatedAt: '', title: null } },
      { id: 'ch-b', attributes: { chapter: '1', translatedLanguage: 'id', pages: 25, updatedAt: '', title: null } },
    ]
    const result = deduplicateChapters(input)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ch-b')
  })

  it('keeps unique chapters when no conflict', async () => {
    const { deduplicateChapters } = await import('./mangadex')
    const input = [
      { id: 'ch-1', attributes: { chapter: '1', translatedLanguage: 'id', pages: 20, updatedAt: '', title: null } },
      { id: 'ch-2', attributes: { chapter: '2', translatedLanguage: 'id', pages: 18, updatedAt: '', title: null } },
    ]
    expect(deduplicateChapters(input)).toHaveLength(2)
  })
})

describe('pickTitle', () => {
  it('prefers Indonesian title', async () => {
    const { pickTitle } = await import('./mangadex')
    expect(pickTitle({ id: 'Indo Title', en: 'English Title' }, [])).toBe('Indo Title')
  })
  it('falls back to English', async () => {
    const { pickTitle } = await import('./mangadex')
    expect(pickTitle({ en: 'English Title' }, [])).toBe('English Title')
  })
  it('falls back to any available title', async () => {
    const { pickTitle } = await import('./mangadex')
    expect(pickTitle({ ja: 'Japanese Title' }, [])).toBe('Japanese Title')
  })
})
