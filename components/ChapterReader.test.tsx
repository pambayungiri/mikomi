import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChapterReader from './ChapterReader'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// jsdom has no IntersectionObserver — capture instances so tests fire them manually
type IOCallback = (entries: { isIntersecting: boolean }[]) => void
const observers: { cb: IOCallback; observed: Element[] }[] = []
class FakeIO {
  observed: Element[] = []
  constructor(private cb: IOCallback) { observers.push({ cb, observed: this.observed }) }
  observe(el: Element) { this.observed.push(el) }
  unobserve() {}
  disconnect() {}
}

function fireSentinel() {
  // last-registered observer is the sentinel's
  observers.at(-1)!.cb([{ isIntersecting: true }])
}

const baseProps = {
  pages: ['https://v7.kiryuu.to/p1.jpg', 'https://v7.kiryuu.to/p2.jpg'],
  slug: 'test-slug',
  chapter: 1,
  prev: null,
  next: 2,
  mangaName: 'Test Manga',
}

describe('ChapterReader auto-append', () => {
  beforeEach(() => {
    localStorage.clear()
    observers.length = 0
    vi.stubGlobal('IntersectionObserver', FakeIO)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('fetches and appends the next chapter when the sentinel intersects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      chapter: 2, pages: ['https://v7.kiryuu.to/p3.jpg'], prev: 1, next: 3,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ChapterReader {...baseProps} />)
    fireSentinel()

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/chapter/test-slug/2')
    )
    // divider + appended page
    expect(await screen.findByText(/Ch\. 1 selesai · Ch\. 2/)).toBeInTheDocument()
    expect(screen.getAllByRole('img').length).toBe(3)
  })

  it('shows a retry divider when the fetch fails, and retries on tap', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        chapter: 2, pages: ['https://v7.kiryuu.to/p3.jpg'], prev: 1, next: 3,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ChapterReader {...baseProps} />)
    fireSentinel()

    const retry = await screen.findByRole('button', { name: /coba lagi/i })
    expect(screen.getByText(/Gagal memuat Ch\. 2/)).toBeInTheDocument()
    fireEvent.click(retry)
    expect(await screen.findByText(/Ch\. 1 selesai · Ch\. 2/)).toBeInTheDocument()
  })

  it('shows the end divider when there is no next chapter', async () => {
    vi.stubGlobal('fetch', vi.fn())
    render(<ChapterReader {...baseProps} next={null} />)
    expect(await screen.findByText(/Chapter terakhir/)).toBeInTheDocument()
  })
})
