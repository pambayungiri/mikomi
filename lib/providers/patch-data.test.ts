import { describe, it, expect } from 'vitest'
import { getPatchedChapterNumbers, getPatchedChapterSlug } from './patch-data'

describe('getPatchedChapterSlug', () => {
  it('returns the mapped komikindo slug for a known manga and chapter number', () => {
    expect(getPatchedChapterSlug('shura-sword-sovereign', 197)).toBe('shura-sword-sovereign-chapter-197')
  })

  it('returns null for a manga not in the patch table', () => {
    expect(getPatchedChapterSlug('some-manga-with-no-patches', 1)).toBeNull()
  })

  it('returns null for a chapter number not patched for a manga that does have other patches', () => {
    expect(getPatchedChapterSlug('shura-sword-sovereign', 999)).toBeNull()
  })
})

describe('getPatchedChapterNumbers', () => {
  it('returns all patched chapter numbers for a manga', () => {
    expect(getPatchedChapterNumbers('shura-sword-sovereign')).toEqual([197])
  })

  it('returns an empty array for a manga not in the patch table', () => {
    expect(getPatchedChapterNumbers('some-manga-with-no-patches')).toEqual([])
  })
})
