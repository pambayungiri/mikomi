import { describe, it, expect } from 'vitest'
import { isKnownEmpty } from './empty-manga'

describe('isKnownEmpty', () => {
  it('returns true for a known-empty manga slug', () => {
    expect(isKnownEmpty('lowongan-tl-dan-ts-kiryuu')).toBe(true)
  })

  it('returns false for a manga slug with real chapters', () => {
    expect(isKnownEmpty('shura-sword-sovereign')).toBe(false)
  })
})
