export function getConfig() {
  const MANGA_PROVIDER = process.env.MANGA_PROVIDER ?? 'keikomik'
  const KEIKOMIK_PROJECT_ID = process.env.KEIKOMIK_PROJECT_ID
  const KEIKOMIK_API_KEY = process.env.KEIKOMIK_API_KEY

  if (!KEIKOMIK_PROJECT_ID) throw new Error('Missing env: KEIKOMIK_PROJECT_ID')
  if (!KEIKOMIK_API_KEY) throw new Error('Missing env: KEIKOMIK_API_KEY')

  return { MANGA_PROVIDER, KEIKOMIK_PROJECT_ID, KEIKOMIK_API_KEY }
}
