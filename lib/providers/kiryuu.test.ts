import { describe, it, expect } from 'vitest'
import { chapterSlugCandidates } from './kiryuu'

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
