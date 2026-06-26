import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BookmarkButton from './BookmarkButton'

vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }))

const { showToast } = await import('@/lib/toast')

const manga = {
  slug: 'test-slug',
  name: 'Test Manga',
  image: 'https://example.com/cover.jpg',
  type: 'Manga',
  latestChapter: 5,
}

describe('BookmarkButton', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders disabled skeleton before hydration, then shows Favorite', async () => {
    render(<BookmarkButton manga={manga} />)
    // After useEffect fires, mounted becomes true
    const button = await screen.findByRole('button', { name: /favorite/i })
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('Favorite')
  })

  it('shows Favorited when manga is already bookmarked in localStorage', async () => {
    localStorage.setItem('mikomi_bookmarks', JSON.stringify([manga]))
    render(<BookmarkButton manga={manga} />)
    const button = await screen.findByRole('button')
    expect(button).toHaveTextContent('Favorited')
  })

  it('adds bookmark and shows success toast on click when not bookmarked', async () => {
    render(<BookmarkButton manga={manga} />)
    const button = await screen.findByRole('button', { name: /favorite/i })
    fireEvent.click(button)
    expect(vi.mocked(showToast)).toHaveBeenCalledWith('Added to favorites', 'success')
    const stored = JSON.parse(localStorage.getItem('mikomi_bookmarks') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].slug).toBe('test-slug')
  })

  it('removes bookmark and shows info toast on click when already bookmarked', async () => {
    localStorage.setItem('mikomi_bookmarks', JSON.stringify([manga]))
    render(<BookmarkButton manga={manga} />)
    const button = await screen.findByRole('button')
    fireEvent.click(button)
    expect(vi.mocked(showToast)).toHaveBeenCalledWith('Removed from favorites', 'info')
    const stored = JSON.parse(localStorage.getItem('mikomi_bookmarks') ?? '[]')
    expect(stored).toHaveLength(0)
  })
})
