#!/usr/bin/env node
// Regenerates lib/providers/komikindo-patches.json from scratch each run.
// For every title in scripts/data/kiryuu-gaps.json, resolves the manga on
// komikindo.ch, probes candidate chapter numbers, and only keeps a match
// that passes both verification gates (title cross-check, page-count
// sanity check) — see docs/superpowers/specs/2026-07-21-komikindo-gap-patch-design.md.
const KOMIKINDO_BASE = 'https://komikindo.ch/wp-json'
const KIRYUU_BASE = 'https://v7.kiryuu.to/wp-json/wp/v2'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' }
const CONCURRENCY = 8
const REQUEST_TIMEOUT_MS = 12000
const fs = await import('fs')
const path = await import('path')
const { fileURLToPath } = await import('url')

process.on('unhandledRejection', (err) => console.error('UNHANDLED REJECTION (continuing):', err))
process.on('uncaughtException', (err) => console.error('UNCAUGHT EXCEPTION (continuing):', err))

function decodeHtml(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–').replace(/&#8220;/g, '“').replace(/&#8221;/g, '”')
}

async function fetchT(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try { return await fetch(url, { headers: HEADERS, signal: ctrl.signal }) }
  finally { clearTimeout(t) }
}

async function resolveKomikindoSlug(title) {
  const res = await fetchT(`${KOMIKINDO_BASE}/wp/v2/manga?search=${encodeURIComponent(title)}&per_page=3&_fields=slug,title`)
  if (!res.ok) return null
  const matches = await res.json()
  const exact = matches.find(m => decodeHtml(m.title.rendered).toLowerCase() === title.toLowerCase())
  // No fallback to matches[0]: an unmatched title must resolve to null rather than
  // risk silently patching in a chapter from a completely unrelated manga — neither
  // downstream verification gate (chapter-title cross-check, page-count sanity) can
  // catch a wrong-manga match, only a wrong-chapter one.
  return exact ? exact.slug : null
}

async function findKomikindoPost(chapterSlug) {
  const res = await fetchT(`${KOMIKINDO_BASE}/wp/v2/posts?slug=${encodeURIComponent(chapterSlug)}&_fields=id,title`)
  if (!res.ok) return null
  const posts = await res.json()
  return posts[0] ?? null
}

async function komikindoPageCount(postId) {
  const res = await fetchT(`${KOMIKINDO_BASE}/apk/v2/chapter/${postId}`)
  if (!res.ok) return 0
  const data = await res.json()
  return Array.isArray(data.image) ? data.image.length : 0
}

const baselineCache = new Map()

async function kiryuuAveragePageCount(kiryuuSlug) {
  if (baselineCache.has(kiryuuSlug)) return baselineCache.get(kiryuuSlug)
  const baseline = await computeKiryuuAveragePageCount(kiryuuSlug)
  baselineCache.set(kiryuuSlug, baseline)
  return baseline
}

async function computeKiryuuAveragePageCount(kiryuuSlug) {
  // orderby=date&order=asc makes results chronological (oldest first), capped at the
  // first 100 posts (this call doesn't paginate further) — so for a title with more
  // than 100 posts, the "middle" sampled below is the middle of that oldest-100 slice,
  // not the true middle of the whole archive. That's still enough to dodge the failure
  // mode this was built for: Kiryuu often paywalls/previews its most-recently-posted
  // chapters down to a handful of pages, and those always sort past this window since
  // it only ever covers the oldest posts. It does NOT guarantee a representative sample
  // for titles whose page-count style changes partway through their own archive —
  // review scripts/data/komikindo-patch-rejections.json for page-count-outlier entries
  // after a full run rather than trusting this baseline blindly.
  const res = await fetchT(`${KIRYUU_BASE}/chapter?search=${encodeURIComponent(kiryuuSlug)}&orderby=date&order=asc&per_page=100&_fields=slug`)
  if (!res.ok) return null
  const posts = await res.json()
  if (posts.length === 0) return null
  const midIdx = Math.max(0, Math.floor(posts.length / 2) - 3)
  const start = Math.min(midIdx, Math.max(0, posts.length - 7))
  const sample = posts.slice(start, start + 7)
  const counts = await Promise.all(sample.map(async (p) => {
    const r = await fetchT(`${KIRYUU_BASE}/chapter?slug=${encodeURIComponent(p.slug)}&_fields=content`)
    if (!r.ok) return 0
    const d = await r.json()
    return (d[0]?.content?.rendered.match(/<img[^>]+src=/gi) || []).length
  }))
  const valid = counts.filter(c => c > 0).sort((a, b) => a - b)
  if (valid.length === 0) return null
  const mid = Math.floor(valid.length / 2)
  return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid]
}

function titleStatesChapter(titleText, n) {
  const m = decodeHtml(titleText ?? '').match(/Chapter\s+\D*?(\d+(?:\.\d+)?)/i)
  return m !== null && Number(m[1]) === n
}

async function verifyCandidate(kiryuuSlug, chapterSlug, n, komikindoNeighborCounts) {
  const post = await findKomikindoPost(chapterSlug)
  if (!post) return { ok: false, reason: 'not-found' }
  if (!titleStatesChapter(post.title?.rendered, n)) return { ok: false, reason: 'title-mismatch' }

  const pageCount = await komikindoPageCount(post.id)
  if (pageCount === 0) return { ok: false, reason: 'no-pages' }

  let baseline = await kiryuuAveragePageCount(kiryuuSlug)
  if (baseline === null) {
    const valid = komikindoNeighborCounts.filter(c => c > 0)
    baseline = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
  }
  if (baseline !== null) {
    const ratio = pageCount / baseline
    if (ratio < 0.3 || ratio > 3) {
      return { ok: false, reason: `page-count-outlier (${pageCount} vs baseline ${baseline.toFixed(1)})` }
    }
  }

  return { ok: true, chapterSlug, pageCount }
}

async function withConcurrency(items, limit, fn) {
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try { await fn(items[i], i) } catch (e) { console.error('item error:', items[i]?.slug, e) }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
}

function expandGapRanges(gapRanges) {
  return gapRanges.split(', ').flatMap(range => {
    const [start, end] = range.split('-').map(Number)
    return end === undefined ? [start] : Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const gaps = JSON.parse(fs.readFileSync(path.join(scriptDir, 'data', 'kiryuu-gaps.json'), 'utf8'))

const patches = {}
const rejected = []
let scanned = 0
const total = gaps.missing.length + gaps.noData.length

await withConcurrency(gaps.missing, CONCURRENCY, async (entry) => {
  scanned++
  if (scanned % 20 === 0) console.error(`  ...${scanned}/${total}`)

  const komikindoSlug = await resolveKomikindoSlug(entry.title)
  if (!komikindoSlug) { rejected.push({ title: entry.title, reason: 'manga-not-found' }); return }

  for (const n of expandGapRanges(entry.gapRanges)) {
    const chapterSlug = `${komikindoSlug}-chapter-${n}`
    const result = await verifyCandidate(entry.slug, chapterSlug, n, [])
    if (result.ok) {
      patches[entry.slug] ??= {}
      patches[entry.slug][String(n)] = result.chapterSlug
    } else {
      rejected.push({ title: entry.title, chapter: n, reason: result.reason })
    }
  }
})

await withConcurrency(gaps.noData, CONCURRENCY, async (entry) => {
  scanned++
  if (scanned % 20 === 0) console.error(`  ...${scanned}/${total}`)

  const komikindoSlug = await resolveKomikindoSlug(entry.title)
  if (!komikindoSlug) { rejected.push({ title: entry.title, reason: 'manga-not-found' }); return }

  let consecutiveMisses = 0
  const neighborCounts = []
  for (let n = 1; n <= 500 && consecutiveMisses < 5; n++) {
    const chapterSlug = `${komikindoSlug}-chapter-${n}`
    const result = await verifyCandidate(entry.slug, chapterSlug, n, neighborCounts)
    if (result.ok) {
      patches[entry.slug] ??= {}
      patches[entry.slug][String(n)] = result.chapterSlug
      neighborCounts.push(result.pageCount)
      consecutiveMisses = 0
    } else {
      consecutiveMisses++
      rejected.push({ title: entry.title, chapter: n, reason: result.reason })
    }
  }
})

fs.writeFileSync(
  path.join(scriptDir, '..', 'lib', 'providers', 'komikindo-patches.json'),
  JSON.stringify(patches, null, 2)
)
fs.writeFileSync(
  path.join(scriptDir, 'data', 'komikindo-patch-rejections.json'),
  JSON.stringify(rejected, null, 2)
)

console.error(`\nDone: ${scanned} titles scanned, ${Object.keys(patches).length} titles patched, ${rejected.length} rejected — see scripts/data/komikindo-patch-rejections.json`)
