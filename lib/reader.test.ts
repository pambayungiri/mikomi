// lib/reader.test.ts
import { describe, it, expect } from 'vitest'
import { activeChapterIndex, chapterProgress } from './reader'

const bounds = [
  { top: 0,    height: 3000 },
  { top: 3000, height: 2000 },
  { top: 5000, height: 4000 },
]

describe('activeChapterIndex', () => {
  it('returns the chapter containing the viewport midline', () => {
    expect(activeChapterIndex(bounds, 0, 800)).toBe(0)        // midline 400
    expect(activeChapterIndex(bounds, 2800, 800)).toBe(1)     // midline 3200
    expect(activeChapterIndex(bounds, 5200, 800)).toBe(2)     // midline 5600
  })

  it('clamps at the edges', () => {
    expect(activeChapterIndex(bounds, 100000, 800)).toBe(2)
    expect(activeChapterIndex([], 500, 800)).toBe(0)
  })
})

describe('chapterProgress', () => {
  it('is 100 when the viewport bottom reaches the chapter end', () => {
    expect(chapterProgress({ top: 0, height: 3000 }, 2200, 800)).toBe(100) // bottom = 3000
  })

  it('is proportional inside the chapter', () => {
    expect(chapterProgress({ top: 3000, height: 2000 }, 3200, 800)).toBe(50) // bottom 4000, 1000/2000
  })

  it('clamps to 0-100', () => {
    expect(chapterProgress({ top: 3000, height: 2000 }, 0, 800)).toBe(0)
    expect(chapterProgress({ top: 0, height: 100 }, 5000, 800)).toBe(100)
  })
})
