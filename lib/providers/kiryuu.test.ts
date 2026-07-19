import { describe, it, expect, afterEach, vi } from 'vitest'
import { chapterSlugCandidates, chapterNumberFromSlug, titleSearchTerms, KiryuuProvider } from './kiryuu'

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

describe('titleSearchTerms', () => {
  it('drops contraction tokens — LIKE cannot match across the apostrophe', () => {
    expect(titleSearchTerms('I’m a Contract Stepmother, but the Tyrant Is Way Too Overprotective'))
      .toBe('Contract Stepmother but the Tyrant Way Too Overprotective')
  })

  it('drops tokens shorter than 3 chars and trims edge punctuation', () => {
    expect(titleSearchTerms('I May Be a Sickly Mom, but I’ll Raise My Fallen Son'))
      .toBe('May Sickly Mom but Raise Fallen Son')
  })

  it('handles straight apostrophes too', () => {
    expect(titleSearchTerms("A Beast Hunter's Way Of Life")).toBe('Beast Way Life')
  })

  it('returns empty string when no usable tokens remain', () => {
    expect(titleSearchTerms("I'm It")).toBe('')
  })
})

describe('KiryuuProvider chapter fallback', () => {
  afterEach(() => vi.unstubAllGlobals())

  const wpJson = (body: unknown, total = 0) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-WP-Total': String(total) },
    })

  it('getManga falls back to title-word search when slug search returns 0 chapters', async () => {
    const slug = 'im-a-test-manga-but-cool'
    const calls: string[] = []

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)

      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_embed')) {
        return wpJson([{
          id: 1, slug, title: { rendered: 'I&#8217;m a Test Manga, but Cool' },
          excerpt: { rendered: '' }, modified: '2026-07-20T00:00:00',
        }], 1)
      }
      if (url.includes('/chapter?') && url.includes(`search=${encodeURIComponent(slug)}`)) {
        return wpJson([], 0)
      }
      if (url.includes('/chapter?') && url.includes(encodeURIComponent('Test Manga but Cool'))) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-01`, date: '2026-07-01' },
          { id: 11, slug: `${slug}-chapter-2`,  date: '2026-07-02' },
          { id: 12, slug: 'other-manga-chapter-5', date: '2026-07-02' },
        ], 3)
      }
      if (url.includes('/manga?') && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'I&#8217;m a Test Manga, but Cool' } }], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)

    expect(manga.chapters.map(c => c.number)).toEqual([2, 1])
    expect(manga.latestChapter).toBe(2)
    expect(calls.some(u => u.includes(encodeURIComponent('Test Manga but Cool')))).toBe(true)
  })
})
