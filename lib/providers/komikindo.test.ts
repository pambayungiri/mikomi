import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchKomikindoChapterPages } from './komikindo'

describe('fetchKomikindoChapterPages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves the post id from the slug, then returns its page images', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wp/v2/posts?slug=shura-sword-sovereign-chapter-197')) {
        return new Response(JSON.stringify([{ id: 106116 }]), { status: 200 })
      }
      if (url.includes('/apk/v2/chapter/106116')) {
        return new Response(
          JSON.stringify({ image: ['https://example.com/1.jpg', 'https://example.com/2.jpg'] }),
          { status: 200 }
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg'])
  })

  it('returns an empty array when the slug does not resolve to any post', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify([]), { status: 200 }))

    const pages = await fetchKomikindoChapterPages('does-not-exist-chapter-1')

    expect(pages).toEqual([])
  })

  it('returns an empty array when the post-lookup request fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual([])
  })

  it('returns an empty array when the chapter-content request fails after a successful post lookup', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wp/v2/posts?slug=')) {
        return new Response(JSON.stringify([{ id: 106116 }]), { status: 200 })
      }
      return new Response('', { status: 500 })
    })

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual([])
  })

  it('returns an empty array when the chapter response has no image array', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/wp/v2/posts?slug=')) {
        return new Response(JSON.stringify([{ id: 106116 }]), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })

    const pages = await fetchKomikindoChapterPages('shura-sword-sovereign-chapter-197')

    expect(pages).toEqual([])
  })
})
