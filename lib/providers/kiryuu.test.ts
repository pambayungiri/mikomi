import { describe, it, expect, afterEach, vi } from 'vitest'
import { chapterNumberFromSlug, titleSearchTerms, KiryuuProvider } from './kiryuu'

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

  it('ignores a trailing non-numeric suffix — reposted/corrected chapters', () => {
    // Real Kiryuu slugs: scanlators repost a corrected chapter as "…-chapter-59-fix"
    // (or, inconsistently, no dash: "…-chapter-208fix"). The strict regex used to
    // reject these outright, making the chapter vanish from the reader entirely.
    expect(chapterNumberFromSlug('some-manga-chapter-59-fix', prefix)).toBe(59)
    expect(chapterNumberFromSlug('some-manga-chapter-208fix', prefix)).toBe(208)
    expect(chapterNumberFromSlug('some-manga-chapter-12-repost', prefix)).toBe(12)
  })

  it('still parses a decimal sub-chapter with a trailing suffix', () => {
    expect(chapterNumberFromSlug('some-manga-chapter-9-1-fix', prefix)).toBe(9.1)
  })

  it('returns null for slugs that do not match the prefix or have no leading number', () => {
    expect(chapterNumberFromSlug('other-manga-chapter-1', prefix)).toBe(null)
    expect(chapterNumberFromSlug('some-manga-chapter-extra', prefix)).toBe(null)
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

  it('caps at 8 tokens — 10+ terms flip WP search into exact-phrase mode', () => {
    expect(titleSearchTerms('Teisou Gyakuten Sekai De Yuiitsu No Otoko Kishi No Ore, Onna Kishi Gakuen Ni Nyuugaku'))
      .toBe('Teisou Gyakuten Sekai Yuiitsu Otoko Kishi Ore Onna')
  })
})

describe('KiryuuProvider search', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches titles only — description matches bury real title hits', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-WP-Total': '0' },
      })
    })

    await new KiryuuProvider().search('over')

    const searchCall = calls.find(u => u.includes('/manga?') && u.includes('search=over'))
    expect(searchCall).toBeDefined()
    expect(searchCall).toContain('search_columns=post_title')
  })
})

describe('KiryuuProvider slim card fetches', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('list fetches skip term embeds and resolve type from manga-type IDs', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return new Response(JSON.stringify([{
        id: 1, slug: 'a', title: { rendered: 'A' }, modified: '2026-07-20T00:00:00',
        'manga-type': [8679],
      }]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    const cards = await new KiryuuProvider().getLatestUpdate()

    expect(cards[0].type).toBe('Manhwa')
    const url = calls[0]
    expect(url).toContain('_fields=')
    expect(url).not.toContain(encodeURIComponent('wp:term'))
  })
})

describe('KiryuuProvider getChapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  const wpJson = (body: unknown, total = 0) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-WP-Total': String(total) },
    })

  it('resolves a chapter whose only post has a non-numeric slug suffix (e.g. "-fix")', async () => {
    const slug = 'some-manga'
    const fixSlug = `${slug}-chapter-59-fix`

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'Some Manga' } }], 1)
      }
      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_embed=wp:featuredmedia')) {
        return wpJson([{ id: 1, title: { rendered: 'Some Manga' }, _embedded: {} }], 1)
      }
      if (url.includes('/chapter?') && url.includes('search_columns=post_title')) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-58`, date: '2021-04-24' },
          { id: 11, slug: fixSlug,               date: '2021-04-24' },
          { id: 12, slug: `${slug}-chapter-60`, date: '2021-04-24' },
        ], 3)
      }
      if (url.includes('/chapter?') && url.includes(`slug=${encodeURIComponent(fixSlug)}`)) {
        return wpJson([{ id: 11, slug: fixSlug, content: { rendered: '<img src="p1.jpg">' } }], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const result = await new KiryuuProvider().getChapter(slug, 59)

    expect(result.pages).toEqual(['p1.jpg'])
    expect(result.prev).toBe(58)
    expect(result.next).toBe(60)
  })

  it('throws when the requested chapter number is not in the list at all', async () => {
    const slug = 'some-manga'
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/manga?') && url.includes('_fields=title')) return wpJson([{ title: { rendered: 'Some Manga' } }], 1)
      if (url.includes('/manga?') && url.includes('_embed=wp:featuredmedia')) return wpJson([{ id: 1, title: { rendered: 'Some Manga' }, _embedded: {} }], 1)
      if (url.includes('/chapter?') && url.includes('search_columns=post_title')) {
        return wpJson([{ id: 10, slug: `${slug}-chapter-1`, date: '2021-01-01' }], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    await expect(new KiryuuProvider().getChapter(slug, 999)).rejects.toThrow()
  })
})

describe('KiryuuProvider chapter fallback', () => {
  afterEach(() => vi.unstubAllGlobals())

  const wpJson = (body: unknown, total = 0) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-WP-Total': String(total) },
    })

  it('getManga finds chapters via fast title-column search first', async () => {
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
      if (url.includes('/manga?') && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'I&#8217;m a Test Manga, but Cool' } }], 1)
      }
      if (url.includes('/chapter?') && url.includes('search_columns=post_title') && url.includes(encodeURIComponent('Test Manga but Cool'))) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-01`, date: '2026-07-01' },
          { id: 11, slug: `${slug}-chapter-2`,  date: '2026-07-02' },
          { id: 12, slug: 'other-manga-chapter-5', date: '2026-07-02' },
        ], 3)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)

    expect(manga.chapters.map(c => c.number)).toEqual([2, 1])
    expect(manga.latestChapter).toBe(2)
    // fast path only — the slow slug-content search must not run
    expect(calls.some(u => u.includes(`search=${encodeURIComponent(slug)}`))).toBe(false)
  })

  it('getManga falls back to slug-content search when the title search is empty', async () => {
    const slug = 'im-a-test-manga-but-cool'

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/manga?') && url.includes(`slug=${slug}`) && url.includes('_embed')) {
        return wpJson([{
          id: 1, slug, title: { rendered: 'I&#8217;m a Test Manga, but Cool' },
          excerpt: { rendered: '' }, modified: '2026-07-20T00:00:00',
        }], 1)
      }
      if (url.includes('/manga?') && url.includes('_fields=title')) {
        return wpJson([{ title: { rendered: 'I&#8217;m a Test Manga, but Cool' } }], 1)
      }
      if (url.includes('/chapter?') && url.includes('search_columns=post_title')) {
        return wpJson([], 0)
      }
      if (url.includes('/chapter?') && url.includes(`search=${encodeURIComponent(slug)}`)) {
        return wpJson([
          { id: 10, slug: `${slug}-chapter-01`, date: '2026-07-01' },
        ], 1)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)
    expect(manga.chapters.map(c => c.number)).toEqual([1])
  })
})
