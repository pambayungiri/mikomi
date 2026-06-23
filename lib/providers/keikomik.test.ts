import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as firestore from '../firestore'

vi.mock('../firestore', () => ({
  runQuery: vi.fn(),
}))

// Import AFTER mock setup
const { KeikomikProvider } = await import('./keikomik')

const SAMPLE_DOC = {
  id: 'abc',
  slug: 'one-piece',
  name: 'One Piece',
  name2: 'ワンピース',
  nameLow: 'one piece',
  type: 'Manga',
  image: 'https://kreisnow.web.id/cover.webp',
  description: 'Pirates story.',
  genre: ['Action', 'Adventure'],
  demographic: ['Shounen'],
  themes: ['Pirates'],
  author: 'Eiichiro Oda',
  artist: 'Eiichiro Oda',
  rate: 9.1,
  rilis: '1997',
  status: 'Ongoing',
  sub: 'bi',
  views: 100000,
  UpdateAt: '2026-06-01T00:00:00Z',
  CreateAt: '2025-01-01T00:00:00Z',
  Komik: {
    '1': { img: ['https://kreisnow.web.id/1/1.jpg', 'https://kreisnow.web.id/1/2.jpg'], UpdateAt: '2025-01-01T00:00:00Z', ket: '' },
    '2': { img: ['https://kreisnow.web.id/2/1.jpg'], UpdateAt: '2026-06-01T00:00:00Z', ket: '' },
    '3': { img: ['', ''], UpdateAt: '2026-06-01T00:00:00Z', ket: '' }, // invalid — img[0] is empty
  },
}

beforeEach(() => vi.clearAllMocks())

describe('KeikomikProvider.getPopular', () => {
  it('returns manga cards ordered by views', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    const result = await provider.getPopular()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('one-piece')
    expect(result[0].latestChapter).toBe(2)  // chapter 3 is invalid (empty img[0])
  })

  it('excludes documents with status tutup', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([{ ...SAMPLE_DOC, status: 'tutup' }])
    const provider = new KeikomikProvider()
    const result = await provider.getPopular()
    expect(result).toHaveLength(0)
  })
})

describe('KeikomikProvider.getManga', () => {
  it('returns manga detail with chapters sorted descending', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    const result = await provider.getManga('one-piece')
    expect(result.slug).toBe('one-piece')
    expect(result.chapters).toHaveLength(2)      // chapter 3 excluded (empty img[0])
    expect(result.chapters[0].number).toBe(2)    // newest first
    expect(result.chapters[1].number).toBe(1)
  })

  it('throws if slug not found', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([])
    const provider = new KeikomikProvider()
    await expect(provider.getManga('not-found')).rejects.toThrow('not found')
  })
})

describe('KeikomikProvider.getChapter', () => {
  it('returns chapter detail with correct prev/next', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    const result = await provider.getChapter('one-piece', 1)
    expect(result.pages).toEqual(['https://kreisnow.web.id/1/1.jpg', 'https://kreisnow.web.id/1/2.jpg'])
    expect(result.prev).toBeNull()    // chapter 1 has no previous
    expect(result.next).toBe(2)
  })

  it('throws if chapter not found', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    await expect(provider.getChapter('one-piece', 99)).rejects.toThrow('Chapter 99 not found')
  })

  it('throws for chapter with empty img[0]', async () => {
    vi.mocked(firestore.runQuery).mockResolvedValue([SAMPLE_DOC])
    const provider = new KeikomikProvider()
    await expect(provider.getChapter('one-piece', 3)).rejects.toThrow('Chapter 3 not found')
  })
})

describe('KeikomikProvider.getGenres', () => {
  it('returns static genre list', () => {
    const provider = new KeikomikProvider()
    const genres = provider.getGenres()
    expect(genres).toContain('Action')
    expect(genres).toContain('Romance')
    expect(genres.length).toBeGreaterThan(5)
  })
})
