import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChapterReader from './ChapterReader'

const routerPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }))

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
  mangaImage: 'cover.jpg',
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

  it('records history and updates the URL when a new chapter becomes active', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      chapter: 2, pages: ['https://v7.kiryuu.to/p3.jpg'], prev: 1, next: 3,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const replaceState = vi.spyOn(window.history, 'replaceState')

    render(<ChapterReader {...baseProps} mangaImage="cover.jpg" />)
    fireSentinel()
    await screen.findByText(/Ch\. 1 selesai · Ch\. 2/)

    // jsdom offsetTop/offsetHeight are 0 — force chapter 2 active by scrolling; the
    // component reads bounds from refs, so stub them:
    const readerDivs = document.querySelectorAll('[data-chapter]')
    Object.defineProperty(readerDivs[0], 'offsetTop', { value: 0 })
    Object.defineProperty(readerDivs[0], 'offsetHeight', { value: 1000 })
    Object.defineProperty(readerDivs[1], 'offsetTop', { value: 1000 })
    Object.defineProperty(readerDivs[1], 'offsetHeight', { value: 1000 })
    window.scrollY = 1200
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledWith(null, '', '/chapter/test-slug/2')
    })
    const history = JSON.parse(localStorage.getItem('mikomi_history') ?? '[]')
    expect(history.some((e: { chapter: number }) => e.chapter === 2)).toBe(true)
  })

  it('single mode: next tap on the last page navigates to the next chapter', async () => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.setItem('mikomi_reading_mode', JSON.stringify('single'))
    render(<ChapterReader {...baseProps} mangaImage="cover.jpg" />)

    const nextZone = await screen.findByRole('button', { name: /next page/i })
    fireEvent.click(nextZone) // page 1 -> 2 (last page)
    fireEvent.click(nextZone) // last page -> next chapter
    expect(routerPush).toHaveBeenCalledWith('/chapter/test-slug/2')
  })
})
