import type { MangaProvider } from './types'
import { MangadexProvider } from './mangadex'

let instance: MangaProvider | null = null

export function getProvider(): MangaProvider {
  if (instance) return instance
  instance = new MangadexProvider()
  return instance
}
