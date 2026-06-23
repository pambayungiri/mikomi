import type { MangaProvider } from './types'
import { KeikomikProvider } from './keikomik'
import { getConfig } from '../config'

let instance: MangaProvider | null = null

export function getProvider(): MangaProvider {
  if (instance) return instance
  const { MANGA_PROVIDER } = getConfig()
  switch (MANGA_PROVIDER) {
    case 'keikomik':
    default:
      instance = new KeikomikProvider()
  }
  return instance
}
