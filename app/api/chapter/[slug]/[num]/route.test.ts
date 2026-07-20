import { describe, it, expect, vi } from 'vitest'

const getChapter = vi.fn()
vi.mock('@/lib/providers', () => ({
  getProvider: () => ({ getChapter }),
}))

const { GET } = await import('./route')

function makeParams(slug: string, num: string) {
  return { params: Promise.resolve({ slug, num }) }
}

describe('GET /api/chapter/[slug]/[num]', () => {
  it('returns chapter, pages, prev, next', async () => {
    getChapter.mockResolvedValueOnce({
      mangaSlug: 'x', mangaName: 'X', mangaImage: '',
      chapter: 2, pages: ['a.jpg', 'b.jpg'], prev: 1, next: 3,
    })
    const res = await GET(new Request('http://t/api/chapter/x/2'), makeParams('x', '2'))
    expect(await res.json()).toEqual({ chapter: 2, pages: ['a.jpg', 'b.jpg'], prev: 1, next: 3 })
  })

  it('accepts decimal chapter numbers without truncating', async () => {
    getChapter.mockResolvedValueOnce({
      mangaSlug: 'x', mangaName: 'X', mangaImage: '',
      chapter: 9.1, pages: ['p.jpg'], prev: 8.3, next: 9.2,
    })
    const res = await GET(new Request('http://t/api/chapter/x/9.1'), makeParams('x', '9.1'))
    expect(getChapter).toHaveBeenLastCalledWith('x', 9.1)
    expect((await res.json()).chapter).toBe(9.1)
  })

  it('400s on a non-numeric chapter', async () => {
    const res = await GET(new Request('http://t/api/chapter/x/abc'), makeParams('x', 'abc'))
    expect(res.status).toBe(400)
  })

  it('400s on a chapter with trailing garbage', async () => {
    const res = await GET(new Request('http://t/api/chapter/x/9.1abc'), makeParams('x', '9.1abc'))
    expect(res.status).toBe(400)
  })
})
