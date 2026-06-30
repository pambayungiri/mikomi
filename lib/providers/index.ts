import type { MangaProvider } from './types'
import { KiryuuProvider } from './kiryuu'

let instance: MangaProvider | null = null

export function getProvider(): MangaProvider {
  if (instance) return instance
  instance = new KiryuuProvider()
  return instance
}
