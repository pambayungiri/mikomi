import { describe, it, expect } from 'vitest'
import { chapterSlugCandidates, chapterNumberFromSlug } from './kiryuu'

describe('chapterNumberFromSlug', () => {
  const prefix = 'some-manga-chapter-'

  it('parses plain and zero-padded chapter numbers', () => {
    expect(chapterNumberFromSlug('some-manga-chapter-1', prefix)).toBe(1)
    expect(chapterNumberFromSlug('some-manga-chapter-01', prefix)).toBe(1)
    expect(chapterNumberFromSlug('some-manga-chapter-10', prefix)).toBe(10)
  })

  it('parses sub-chapter slugs as decimals (WP slugifies 9.1 to 9-1)', () => {
    expect(chapterNumberFromSlug('some-manga-chapter-9-1', prefix)).toBe(9.1)
    expect(chapterNumberFromSlug('some-manga-chapter-4-5', prefix)).toBe(4.5)
    expect(chapterNumberFromSlug('some-manga-chapter-09-2', prefix)).toBe(9.2)
  })

  it('returns null for slugs that do not match the prefix or number', () => {
    expect(chapterNumberFromSlug('other-manga-chapter-1', prefix)).toBe(null)
    expect(chapterNumberFromSlug('some-manga-chapter-extra', prefix)).toBe(null)
  })
})

describe('chapterSlugCandidates', () => {
  it('includes both unpadded and zero-padded slugs for chapters 1-9', () => {
    expect(chapterSlugCandidates('some-manga', 1)).toBe('some-manga-chapter-1,some-manga-chapter-01')
    expect(chapterSlugCandidates('some-manga', 9)).toBe('some-manga-chapter-9,some-manga-chapter-09')
  })

  it('returns a single slug for chapters 10 and above', () => {
    expect(chapterSlugCandidates('some-manga', 10)).toBe('some-manga-chapter-10')
    expect(chapterSlugCandidates('some-manga', 123)).toBe('some-manga-chapter-123')
  })

  it('slugifies decimal chapters the way WordPress does (dot becomes dash)', () => {
    expect(chapterSlugCandidates('some-manga', 5.5)).toBe('some-manga-chapter-5-5,some-manga-chapter-05-5')
    expect(chapterSlugCandidates('some-manga', 10.5)).toBe('some-manga-chapter-10-5')
  })
})
