export function getConfig() {
  const MANGA_PROVIDER = process.env.MANGA_PROVIDER ?? 'mangadex'
  return { MANGA_PROVIDER }
}
