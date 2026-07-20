import { describe, it, expect, afterEach, vi } from 'vitest'
import { chapterNumberFromSlug, reconcileChapterNumber, titleSearchTerms, KiryuuProvider } from './kiryuu'

describe('reconcileChapterNumber', () => {
  it('trusts the title over a dash-dropped-decimal slug — Kiryuu sometimes drops the dash', () => {
    // Real Kiryuu data: "…-chapter-1605" whose own title reads "Chapter 160.5" —
    // the site dropped the dash (should've been "…-chapter-160-5"). The slug
    // parses as a plausible-looking integer, so nothing else catches this.
    expect(reconcileChapterNumber(1605, 'Kimetsu no Yaiba Chapter 160.5')).toBe(160.5)
    expect(reconcileChapterNumber(11, 'Monster Musume no Oishasan Chapter 1.1')).toBe(1.1)
    expect(reconcileChapterNumber(1281, 'To Be The Castellan King Chapter 128.1')).toBe(128.1)
  })

  it('uses the first number for a combined-release title — slug dash means range, not decimal', () => {
    // Slug "chapter-656-657" parses as decimal 656.657 by the normal sub-chapter
    // rule, but the title "Chapter 656-657" means chapters 656 and 657 bundled
    // into one post — 656 is the number readers actually navigate to.
    expect(reconcileChapterNumber(656.657, 'God of Martial Arts Chapter 656-657')).toBe(656)
    expect(reconcileChapterNumber(131.132, 'I Have a Dragon in My Body Chapter 131-132')).toBe(131)
  })

  it('leaves a correctly-parsed decimal slug alone when the title just abbreviates it', () => {
    // Slug "chapter-42-2" correctly parses as 42.2 (part 2 of chapter 42); the
    // site's title text just says "Chapter 42" for both parts without
    // restating ".2" — the slug is right here, nothing to override.
    expect(reconcileChapterNumber(42.2, 'Arifureta Shokugyou de Sekai Saikyou Chapter 42')).toBe(42.2)
  })

  it('keeps the slug number when title and slug disagree with no recognizable pattern', () => {
    // Real Kiryuu data: slug says 432, title says "Chapter 342" — a site-side
    // typo with no reliable signal for which number is correct. Don't guess.
    expect(reconcileChapterNumber(432, 'Release That Witch Chapter 342')).toBe(432)
  })

  it('does not collapse "Chapter N-M" part markers into a combined-range — only a genuine multi-digit range triggers that', () => {
    // Real Kiryuu data: "Apotheosis" posts "…chapter-1-1" and "…chapter-1-2",
    // titled "Chapter 1-1" and "Chapter 1-2" — these are part 1 and part 2 of
    // chapter 1, not "chapters 1 and 2 combined". The combined-range title
    // regex alone can't tell them apart from a real range like "656-657", so
    // it also requires the slug's normal decimal parse to look implausible
    // (a multi-digit fraction) before overriding. 1.1/1.2 are plausible
    // sub-chapter fractions and must be left alone, or both posts collapse
    // to chapter "1" and one silently overwrites the other.
    expect(reconcileChapterNumber(1.1, 'Apotheosis Chapter 1-1')).toBe(1.1)
    expect(reconcileChapterNumber(1.2, 'Apotheosis Chapter 1-2')).toBe(1.2)
  })

  it('returns the slug number unchanged when there is no title or no number in it', () => {
    expect(reconcileChapterNumber(5, '')).toBe(5)
    expect(reconcileChapterNumber(5, 'Some Manga Bonus Art')).toBe(5)
  })

  it('returns the slug number unchanged when slug and title already agree', () => {
    expect(reconcileChapterNumber(12, 'Some Manga Chapter 12')).toBe(12)
    expect(reconcileChapterNumber(9.1, 'Some Manga Chapter 9.1')).toBe(9.1)
  })
})

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

  it('getManga corrects a dash-dropped-decimal chapter using its own title text', async () => {
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
        return wpJson([
          { id: 10, slug: `${slug}-chapter-1`, date: '2026-07-01', title: { rendered: 'Test Manga but Cool Chapter 1' } },
          // dash dropped: slug reads as integer 11, title says it's really 1.1
          { id: 11, slug: `${slug}-chapter-11`, date: '2026-07-02', title: { rendered: 'Test Manga but Cool Chapter 1.1' } },
        ], 2)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)

    expect(manga.chapters.map(c => c.number)).toEqual([1.1, 1])
    expect(manga.latestChapter).toBe(1.1)
  })

  it('getManga recovers a chapter whose slug buries the number after other text', async () => {
    // Real Kiryuu data: "Wonderwall" posts slugs like "…chapter-ep-2-siapa-dia"
    // — chapterNumberFromSlug requires the number to lead, so these were
    // silently dropped from the chapter list entirely (not a gap, a full
    // disappearance). The number is unambiguous in the chapter's own title.
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
        return wpJson([
          { id: 10, slug: `${slug}-chapter-1`, date: '2026-07-01', title: { rendered: 'Test Manga but Cool Chapter 1' } },
          { id: 11, slug: `${slug}-chapter-ep-2-siapa-dia`, date: '2026-07-02', title: { rendered: 'Test Manga but Cool Chapter ep. 2 – siapa dia?' } },
          { id: 12, slug: `${slug}-chapter-prolog`, date: '2026-06-30', title: { rendered: 'Test Manga but Cool Chapter prolog' } },
        ], 3)
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const manga = await new KiryuuProvider().getManga(slug)

    // prolog has no number at all — correctly excluded, not a numbered chapter
    expect(manga.chapters.map(c => c.number)).toEqual([2, 1])
    expect(manga.latestChapter).toBe(2)
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
