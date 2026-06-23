import { getConfig } from './config'

export type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }

export function parseValue(v: FirestoreValue): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(parseValue)
  if ('mapValue' in v) {
    const fields = v.mapValue.fields ?? {}
    return Object.fromEntries(Object.entries(fields).map(([k, val]) => [k, parseValue(val)]))
  }
  return null
}

export function parseDoc(doc: {
  name: string
  fields: Record<string, FirestoreValue>
}): Record<string, unknown> & { id: string } {
  const id = doc.name.split('/').at(-1)!
  const fields = Object.fromEntries(
    Object.entries(doc.fields).map(([k, v]) => [k, parseValue(v)])
  )
  return { id, ...fields }
}

type FirestoreResult = { document?: { name: string; fields: Record<string, FirestoreValue> } }

export async function runQuery(
  query: Record<string, unknown>,
  revalidate?: number
): Promise<(Record<string, unknown> & { id: string })[]> {
  const { KEIKOMIK_PROJECT_ID, KEIKOMIK_API_KEY } = getConfig()
  const url = `https://firestore.googleapis.com/v1/projects/${KEIKOMIK_PROJECT_ID}/databases/(default)/documents:runQuery?key=${KEIKOMIK_API_KEY}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query }),
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' }),
  })

  if (!res.ok) throw new Error(`Firestore error: ${res.status} ${await res.text()}`)

  const results: FirestoreResult[] = await res.json()
  return results.filter(r => r.document).map(r => parseDoc(r.document!))
}
