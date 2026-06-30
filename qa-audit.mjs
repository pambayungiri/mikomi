import { chromium } from 'playwright'

const BASE = 'https://mikomi-7payt6ouk-pambayungiris-projects.vercel.app'
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
const DESKTOP = { width: 1280, height: 800 }

const results = []
let firstMangaSlug = null
let firstChapterNum = null

function log(category, test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️'
  console.log(`${icon} [${category}] ${test}${detail ? ` — ${detail}` : ''}`)
  results.push({ category, test, status, detail })
}

async function waitAndCheck(page, selector, label) {
  try {
    await page.waitForSelector(selector, { timeout: 8000 })
    return true
  } catch {
    log('DOM', label, 'FAIL', `selector not found: ${selector}`)
    return false
  }
}

const browser = await chromium.launch({ headless: true })

// ─────────────────────────────────────────────
// 1. HOMEPAGE — desktop
// ─────────────────────────────────────────────
console.log('\n=== HOMEPAGE (desktop) ===')
const desktop = await browser.newContext({ viewport: DESKTOP })
const home = await desktop.newPage()
let homeRes
try {
  homeRes = await home.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 })
  log('HTTP', 'Homepage loads', homeRes.status() < 400 ? 'PASS' : 'FAIL', `HTTP ${homeRes.status()}`)
} catch (e) {
  log('HTTP', 'Homepage loads', 'FAIL', e.message); process.exit(1)
}

// Title
const title = await home.title()
log('SEO', 'Page title set', title.length > 5 ? 'PASS' : 'FAIL', title)

// Nav
const navLogo = await home.$('nav img, header img, a[href="/"] img')
log('UI', 'Nav logo visible', navLogo ? 'PASS' : 'FAIL')

// Manga cards on homepage
const cards = await home.$$('a[href^="/manga/"]')
log('Content', `Manga cards on homepage`, cards.length >= 4 ? 'PASS' : 'FAIL', `${cards.length} cards`)

if (cards.length > 0) {
  // Extract first manga slug
  const href = await cards[0].getAttribute('href')
  firstMangaSlug = href // e.g. /manga/one-piece
  log('Content', 'First manga href', firstMangaSlug ? 'PASS' : 'FAIL', firstMangaSlug)
}

// Hero carousel
const hero = await home.$('[class*="carousel"], [class*="hero"], [class*="swiper"]')
log('UI', 'Hero carousel present', hero ? 'PASS' : 'WARN', hero ? '' : 'not found (may be named differently)')

// Sections (Latest Update, New Arrivals, etc.)
const headings = await home.$$eval('h2', els => els.map(e => e.textContent?.trim()).filter(Boolean))
log('Content', 'Section headings present', headings.length >= 2 ? 'PASS' : 'FAIL', headings.slice(0, 4).join(', '))

await home.close()
await desktop.close()

// ─────────────────────────────────────────────
// 2. MANGA DETAIL PAGE
// ─────────────────────────────────────────────
console.log('\n=== MANGA DETAIL PAGE ===')
if (firstMangaSlug) {
  const detailCtx = await browser.newContext({ viewport: DESKTOP })
  const detail = await detailCtx.newPage()
  try {
    const detailRes = await detail.goto(`${BASE}${firstMangaSlug}`, { waitUntil: 'networkidle', timeout: 20000 })
    log('HTTP', 'Manga detail loads', detailRes.status() < 400 ? 'PASS' : 'FAIL', `HTTP ${detailRes.status()}`)
  } catch(e) { log('HTTP', 'Manga detail loads', 'FAIL', e.message) }

  // SEO title
  const detailTitle = await detail.title()
  const hasIndonesian = detailTitle.includes('Baca') && detailTitle.includes('Mikomi')
  log('SEO', 'Indonesian title format', hasIndonesian ? 'PASS' : 'FAIL', detailTitle)

  // JSON-LD
  const jsonld = await detail.$('script[type="application/ld+json"]')
  log('SEO', 'JSON-LD structured data', jsonld ? 'PASS' : 'FAIL')
  if (jsonld) {
    const content = await jsonld.textContent()
    try {
      const data = JSON.parse(content)
      log('SEO', 'JSON-LD @type is Book', data['@type'] === 'Book' ? 'PASS' : 'FAIL', data['@type'])
    } catch { log('SEO', 'JSON-LD parseable', 'FAIL') }
  }

  // Cover image
  const coverImg = await detail.$('img[alt], img[src*="mangadex"]')
  log('Content', 'Cover image present', coverImg ? 'PASS' : 'WARN')

  // Chapter list
  const chapterLinks = await detail.$$('a[href*="/chapter/"]')
  log('Content', 'Chapter list present', chapterLinks.length > 0 ? 'PASS' : 'FAIL', `${chapterLinks.length} chapters`)

  if (chapterLinks.length > 0) {
    const chHref = await chapterLinks[0].getAttribute('href')
    // /chapter/slug/1 — extract chapter number
    const match = chHref?.match(/\/chapter\/[^/]+\/(\d+(?:\.\d+)?)/)
    firstChapterNum = match ? match[1] : null
    log('Content', 'Chapter link format correct', chHref?.startsWith('/chapter/') ? 'PASS' : 'FAIL', chHref)
  }

  // Genre tags
  const genres = await detail.$$('a[href*="genre"], span[class*="genre"], [class*="tag"]')
  log('Content', 'Genre tags visible', genres.length > 0 ? 'PASS' : 'WARN', `${genres.length} tags`)

  // Description
  const desc = await detail.$('p, [class*="description"], [class*="synopsis"]')
  log('Content', 'Description/synopsis present', desc ? 'PASS' : 'WARN')

  await detail.close()
  await detailCtx.close()
}

// ─────────────────────────────────────────────
// 3. CHAPTER READER
// ─────────────────────────────────────────────
console.log('\n=== CHAPTER READER ===')
if (firstMangaSlug && firstChapterNum) {
  const slugOnly = firstMangaSlug.replace('/manga/', '')
  const chapterUrl = `${BASE}/chapter/${slugOnly}/${firstChapterNum}`
  const readerCtx = await browser.newContext({ viewport: MOBILE })
  const reader = await readerCtx.newPage()
  try {
    const readerRes = await reader.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 25000 })
    log('HTTP', 'Chapter page loads', readerRes.status() < 400 ? 'PASS' : 'FAIL', `HTTP ${readerRes.status()}`)
  } catch(e) { log('HTTP', 'Chapter page loads', 'FAIL', e.message) }

  // Chapter title
  const chTitle = await reader.title()
  const hasSubIndo = chTitle.includes('Sub Indo') || chTitle.includes('Baca')
  log('SEO', 'Chapter title has Indonesian format', hasSubIndo ? 'PASS' : 'FAIL', chTitle)

  // Images via proxy
  await reader.waitForTimeout(3000)
  const proxyImgs = await reader.$$('img[src*="/api/proxy-image"]')
  log('Content', 'Chapter images via proxy', proxyImgs.length > 0 ? 'PASS' : 'FAIL', `${proxyImgs.length} proxy images`)

  // Nav prev/next
  const prevNext = await reader.$$('a[href*="/chapter/"], button[aria-label*="prev"], button[aria-label*="next"]')
  log('UI', 'Prev/Next chapter navigation', prevNext.length >= 1 ? 'PASS' : 'WARN', `${prevNext.length} nav elements`)

  await reader.close()
  await readerCtx.close()
}

// ─────────────────────────────────────────────
// 4. LIST / BROWSE PAGE
// ─────────────────────────────────────────────
console.log('\n=== LIST / BROWSE PAGE ===')
const listCtx = await browser.newContext({ viewport: MOBILE })
const list = await listCtx.newPage()
try {
  const listRes = await list.goto(`${BASE}/list`, { waitUntil: 'networkidle', timeout: 20000 })
  log('HTTP', '/list loads', listRes.status() < 400 ? 'PASS' : 'FAIL', `HTTP ${listRes.status()}`)
} catch(e) { log('HTTP', '/list loads', 'FAIL', e.message) }

// Genre filter
const genreFilter = await list.$('[class*="genre"], select, [class*="filter"]')
log('UI', 'Genre filter present', genreFilter ? 'PASS' : 'WARN')

// Manga grid
const listCards = await list.$$('a[href^="/manga/"]')
log('Content', 'Manga cards in list', listCards.length >= 4 ? 'PASS' : 'FAIL', `${listCards.length} cards`)

// Search bar
const searchInput = await list.$('input[type="search"], input[placeholder*="cari"], input[placeholder*="search"], input[placeholder*="Search"]')
log('UI', 'Search bar present', searchInput ? 'PASS' : 'FAIL')

if (searchInput) {
  await searchInput.fill('naruto')
  await list.waitForTimeout(1500)
  const searchResults = await list.$$('a[href^="/manga/"]')
  log('Functionality', 'Search returns results', searchResults.length > 0 ? 'PASS' : 'WARN', `${searchResults.length} results for "naruto"`)
}

await list.close()
await listCtx.close()

// ─────────────────────────────────────────────
// 5. SITEMAP
// ─────────────────────────────────────────────
console.log('\n=== SEO / SITEMAP ===')
const seoCtx = await browser.newContext({ viewport: DESKTOP })
const seoPage = await seoCtx.newPage()
const sitemapRes = await seoPage.goto(`${BASE}/sitemap.xml`, { timeout: 15000 })
log('SEO', 'sitemap.xml accessible', sitemapRes.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${sitemapRes.status()}`)
const sitemapContent = await seoPage.content()
const mangaUrlCount = (sitemapContent.match(/\/manga\//g) || []).length
log('SEO', 'Sitemap has /manga/ entries', mangaUrlCount > 5 ? 'PASS' : 'FAIL', `${mangaUrlCount} manga URLs`)

const robotsRes = await seoPage.goto(`${BASE}/robots.txt`, { timeout: 10000 })
log('SEO', 'robots.txt accessible', robotsRes.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${robotsRes.status()}`)
const robotsTxt = await seoPage.content()
log('SEO', 'robots.txt has Sitemap line', robotsTxt.includes('sitemap.xml') ? 'PASS' : 'FAIL')

await seoPage.close()
await seoCtx.close()

// ─────────────────────────────────────────────
// 6. MOBILE UX
// ─────────────────────────────────────────────
console.log('\n=== MOBILE UX ===')
const mobCtx = await browser.newContext({ viewport: MOBILE })
const mob = await mobCtx.newPage()
await mob.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 })

// Bottom nav
const bottomNav = await mob.$('nav:last-of-type, [class*="bottom"], footer nav')
log('UI', 'Bottom nav present (mobile)', bottomNav ? 'PASS' : 'WARN')

// No horizontal overflow
const overflowX = await mob.evaluate(() => document.body.scrollWidth > window.innerWidth)
log('UI', 'No horizontal scroll overflow', overflowX ? 'FAIL' : 'PASS', overflowX ? `body scrollWidth > ${MOBILE.width}` : 'clean')

// Tap target size — all links should be >= 44px height
const smallTargets = await mob.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button'))
  return links.filter(el => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.height < 36
  }).length
})
log('UX', 'Tap targets >= 36px', smallTargets === 0 ? 'PASS' : 'WARN', smallTargets > 0 ? `${smallTargets} small targets` : '')

await mob.close()
await mobCtx.close()

await browser.close()

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────
console.log('\n═══════════════════════════════════════')
console.log('           QA AUDIT SUMMARY')
console.log('═══════════════════════════════════════')
const pass = results.filter(r => r.status === 'PASS').length
const fail = results.filter(r => r.status === 'FAIL').length
const warn = results.filter(r => r.status === 'WARN').length
console.log(`✅ PASS: ${pass}  ❌ FAIL: ${fail}  ⚠️  WARN: ${warn}`)
console.log(`Total: ${results.length} checks`)
if (fail > 0) {
  console.log('\nFAILURES:')
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ [${r.category}] ${r.test}${r.detail ? ` — ${r.detail}` : ''}`))
}
if (warn > 0) {
  console.log('\nWARNINGS:')
  results.filter(r => r.status === 'WARN').forEach(r => console.log(`  ⚠️  [${r.category}] ${r.test}${r.detail ? ` — ${r.detail}` : ''}`))
}
