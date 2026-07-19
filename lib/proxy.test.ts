import { describe, it, expect } from 'vitest'
import { proxyUrl, isProxiedHost } from './proxy'

describe('isProxiedHost', () => {
  it('matches any versioned kiryuu.to host', () => {
    expect(isProxiedHost('v6.kiryuu.to')).toBe(true)
    expect(isProxiedHost('v7.kiryuu.to')).toBe(true)
    expect(isProxiedHost('v12.kiryuu.to')).toBe(true)
  })

  it('matches chapter image CDN hosts and their subdomains', () => {
    expect(isProxiedHost('yuucdn.com')).toBe(true)
    expect(isProxiedHost('img.yuucdn.com')).toBe(true)
    expect(isProxiedHost('cdn.uqni.net')).toBe(true)
  })

  it('rejects lookalike and unrelated hosts', () => {
    expect(isProxiedHost('v7.kiryuu.to.evil.com')).toBe(false)
    expect(isProxiedHost('kiryuu.to')).toBe(false)
    expect(isProxiedHost('example.com')).toBe(false)
    expect(isProxiedHost('notyuucdn.com')).toBe(false)
  })
})

describe('proxyUrl', () => {
  it('proxies v7.kiryuu.to covers through /api/cover', () => {
    const url = 'https://v7.kiryuu.to/wp-content/uploads/2025/10/cover.jpg'
    expect(proxyUrl(url)).toBe(`/api/cover?url=${encodeURIComponent(url)}`)
  })

  it('proxies v6.kiryuu.to covers through /api/cover', () => {
    const url = 'https://v6.kiryuu.to/wp-content/uploads/2021/03/cover.jpg'
    expect(proxyUrl(url)).toBe(`/api/cover?url=${encodeURIComponent(url)}`)
  })

  it('proxies chapter CDN images through /api/cover', () => {
    const url = 'https://cdn.uqni.net/some/page-01.webp'
    expect(proxyUrl(url)).toBe(`/api/cover?url=${encodeURIComponent(url)}`)
  })

  it('passes through non-kiryuu urls unchanged', () => {
    expect(proxyUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
  })

  it('returns placeholder for empty url', () => {
    expect(proxyUrl('')).toBe('/placeholder-cover.jpg')
  })

  it('passes through invalid urls unchanged', () => {
    expect(proxyUrl('not-a-url')).toBe('not-a-url')
  })
})
