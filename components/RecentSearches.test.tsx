import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RecentSearches from './RecentSearches'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('RecentSearches', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders nothing when localStorage has no recent searches', () => {
    const { container } = render(<RecentSearches />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders recent searches stored in localStorage', async () => {
    localStorage.setItem('mikomi_recent_searches', JSON.stringify(['naruto', 'one piece']))
    render(<RecentSearches />)
    expect(await screen.findByText('naruto')).toBeInTheDocument()
    expect(screen.getByText('one piece')).toBeInTheDocument()
  })

  it('navigates to /list?q= when a recent search is clicked', async () => {
    localStorage.setItem('mikomi_recent_searches', JSON.stringify(['bleach']))
    render(<RecentSearches />)
    fireEvent.click(await screen.findByText('bleach'))
    expect(mockPush).toHaveBeenCalledWith('/list?q=bleach')
  })

  it('clears recent searches and hides component when Clear is clicked', async () => {
    localStorage.setItem('mikomi_recent_searches', JSON.stringify(['naruto']))
    const { container } = render(<RecentSearches />)
    fireEvent.click(await screen.findByText('Clear'))
    expect(localStorage.getItem('mikomi_recent_searches')).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })
})
