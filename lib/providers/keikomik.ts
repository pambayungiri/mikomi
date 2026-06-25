import { runQuery } from '../firestore'
import Fuse from 'fuse.js'
import type { MangaCard, MangaDetail, ChapterDetail, ChapterMeta, PaginatedResult, MangaProvider } from './types'

const GENRES = [
  'Action', 'Fantasy', 'Adventure', 'Comedy', 'Sci-Fi',
  'Romance', 'Mystery', 'Horror', 'Slice of Life', 'Supernatural', 'Isekai',
]

type RawKomikChapter = { img: string[]; UpdateAt?: string; ket?: string }
type RawDoc = Record<string, unknown> & { id: string }

function validChapters(komik: Record<string, RawKomikChapter>): [number, RawKomikChapter][] {
  return Object.entries(komik)
    .filter(([, ch]) => Array.isArray(ch.img) && ch.img.length > 0 && ch.img[0] !== '')
    .map(([num, ch]) => [Number(num), ch] as [number, RawKomikChapter])
    .sort((a, b) => a[0] - b[0])
}

function parseMangaCard(doc: RawDoc): MangaCard {
  const komik = (doc.Komik ?? {}) as Record<string, RawKomikChapter>
  const chapters = validChapters(komik)
  const latestChapter = chapters.length > 0 ? chapters[chapters.length - 1][0] : null
  return {
    id: doc.id,
    slug: doc.slug as string,
    name: doc.name as string,
    type: (doc.type as string) ?? 'Manga',
    image: doc.image as string,
    latestChapter,
    updatedAt: (doc.UpdateAt as string) ?? '',
  }
}

function parseMangaDetail(doc: RawDoc): MangaDetail {
  const komik = (doc.Komik ?? {}) as Record<string, RawKomikChapter>
  const sorted = validChapters(komik)

  const chapters: ChapterMeta[] = sorted
    .map(([num, ch]) => ({
      number: num,
      updatedAt: ch.UpdateAt ?? '',
      note: ch.ket ?? '',
    }))
    .reverse() // newest first

  const card = parseMangaCard(doc)
  return {
    ...card,
    name2: (doc.name2 as string) ?? '',
    description: (doc.description as string) ?? '',
    genre: (doc.genre as string[]) ?? [],
    demographic: (doc.demographic as string[]) ?? [],
    themes: (doc.themes as string[]) ?? [],
    author: (doc.author as string) ?? '',
    artist: (doc.artist as string) ?? '',
    rate: (doc.rate as number) ?? 0,
    status: (doc.status as string) ?? 'Ongoing',
    rilis: (doc.rilis as string) ?? '',
    chapters,
  }
}

function sortDocs(docs: RawDoc[], sort?: string): RawDoc[] {
  return [...docs].sort((a, b) => {
    if (sort === 'rating') return ((b.rate as number) ?? 0) - ((a.rate as number) ?? 0)
    if (sort === 'create') {
      const ta = (a.CreateAt as string) ?? ''
      const tb = (b.CreateAt as string) ?? ''
      return tb > ta ? 1 : tb < ta ? -1 : 0
    }
    const ta = (a.UpdateAt as string) ?? ''
    const tb = (b.UpdateAt as string) ?? ''
    return tb > ta ? 1 : tb < ta ? -1 : 0
  })
}

export class KeikomikProvider implements MangaProvider {
  getGenres(): string[] {
    return GENRES
  }

  async getPopular(): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'views' }, direction: 'DESCENDING' }],
      limit: 8,
    }, 3600)
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }

  async getLatestUpdate(): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'UpdateAt' }, direction: 'DESCENDING' }],
      limit: 12,
    }, 3600)
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }

  async getNewArrivals(): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'CreateAt' }, direction: 'DESCENDING' }],
      limit: 10,
    }, 3600)
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }

  async getPopularByType(type: string): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'type' },
          op: 'EQUAL',
          value: { stringValue: type },
        },
      },
      limit: 30,
    }, 3600)
    return docs
      .filter(d => d.status !== 'tutup')
      .sort((a, b) => ((b.views as number) ?? 0) - ((a.views as number) ?? 0))
      .slice(0, 8)
      .map(parseMangaCard)
  }

  async getList(opts: {
    genre?: string
    sort?: 'update' | 'create' | 'rating'
    type?: string
    after?: string
  }): Promise<PaginatedResult<MangaCard>> {
    // Type filter — fetch without orderBy to avoid composite index, sort client-side
    if (opts.type) {
      const docs = await runQuery({
        from: [{ collectionId: 'KomikApp' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'type' },
            op: 'EQUAL',
            value: { stringValue: opts.type },
          },
        },
        limit: 100,
      }, 3600)
      const data = sortDocs(docs.filter(d => d.status !== 'tutup'), opts.sort).map(parseMangaCard)
      return { data, nextCursor: null, hasMore: false }
    }

    // Genre filter — no orderBy to avoid composite index requirement
    if (opts.genre) {
      const docs = await runQuery({
        from: [{ collectionId: 'KomikApp' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'genre' },
            op: 'ARRAY_CONTAINS',
            value: { stringValue: opts.genre },
          },
        },
        limit: 100,
      }, 3600)
      const data = docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
      return { data, nextCursor: null, hasMore: false }
    }

    // Rating sort — single field orderBy, no composite index needed
    if (opts.sort === 'rating') {
      const docs = await runQuery({
        from: [{ collectionId: 'KomikApp' }],
        orderBy: [{ field: { fieldPath: 'rate' }, direction: 'DESCENDING' }],
        limit: 50,
      }, 3600)
      const data = docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
      return { data, nextCursor: null, hasMore: false }
    }

    // Default: sort by UpdateAt or CreateAt with cursor pagination
    const orderField = opts.sort === 'create' ? 'CreateAt' : 'UpdateAt'
    const query: Record<string, unknown> = {
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }],
      limit: 36,
    }

    if (opts.after) {
      query.startAt = {
        values: [{ timestampValue: opts.after }],
        before: false, // startAfter semantics
      }
    }

    const docs = await runQuery(query, 3600)
    const filtered = docs.filter(d => d.status !== 'tutup')
    const data = filtered.map(parseMangaCard)
    const hasMore = opts.sort === 'create' ? false : docs.length === 36
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].updatedAt : null

    return { data, nextCursor, hasMore }
  }

  async getManga(slug: string): Promise<MangaDetail> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'slug' },
          op: 'EQUAL',
          value: { stringValue: slug },
        },
      },
      limit: 1,
    }, 1800)

    if (!docs.length) throw new Error(`Manga not found: ${slug}`)
    return parseMangaDetail(docs[0])
  }

  async getChapter(slug: string, chapter: number): Promise<ChapterDetail> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'slug' },
          op: 'EQUAL',
          value: { stringValue: slug },
        },
      },
      limit: 1,
    }, 86400)

    if (!docs.length) throw new Error(`Manga not found: ${slug}`)
    const doc = docs[0]
    const komik = (doc.Komik ?? {}) as Record<string, RawKomikChapter>
    const chapterData = komik[String(chapter)]
    if (!chapterData || !Array.isArray(chapterData.img) || chapterData.img.length === 0 || chapterData.img[0] === '') {
      throw new Error(`Chapter ${chapter} not found in ${slug}`)
    }

    const allNums = validChapters(komik).map(([n]) => n)
    const idx = allNums.indexOf(chapter)
    const prev = idx > 0 ? allNums[idx - 1] : null
    const next = idx < allNums.length - 1 ? allNums[idx + 1] : null

    return {
      mangaSlug: slug,
      mangaName: doc.name as string,
      mangaImage: doc.image as string,
      chapter,
      pages: chapterData.img.filter(Boolean),
      prev,
      next,
    }
  }

  async getRelated(genre: string, excludeSlug: string): Promise<MangaCard[]> {
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'genre' },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: genre },
        },
      },
      limit: 15,
    }, 3600)
    return docs
      .filter(d => d.status !== 'tutup' && d.slug !== excludeSlug)
      .slice(0, 8)
      .map(parseMangaCard)
  }

  async search(query: string, opts?: { type?: string }): Promise<MangaCard[]> {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const words = q.split(/\s+/).filter(w => w.length >= 2)

    const makePrefix = (prefix: string) => runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'nameLow' }, direction: 'ASCENDING' }],
      startAt: { values: [{ stringValue: prefix }], before: true },
      endAt: { values: [{ stringValue: prefix + '' }], before: false },
      limit: 25,
    })

    // Search by full query + each individual word (for multi-word queries)
    const prefixes = [...new Set([q, ...words])]

    // Fetch prefix results + popular pool for fuzzy fallback in parallel
    const [batches, popularPool] = await Promise.all([
      Promise.all(prefixes.map(makePrefix)),
      runQuery({
        from: [{ collectionId: 'KomikApp' }],
        orderBy: [{ field: { fieldPath: 'views' }, direction: 'DESCENDING' }],
        limit: 200,
      }, 3600),
    ])

    // Merge prefix results and deduplicate
    const seen = new Set<string>()
    const all: RawDoc[] = []
    for (const batch of batches) {
      for (const doc of batch) {
        if (!seen.has(doc.id) && doc.status !== 'tutup') {
          seen.add(doc.id)
          all.push(doc)
        }
      }
    }

    // Fuse.js fuzzy search on popular pool to catch typos (e.g. "nartu" → "Naruto")
    const fuse = new Fuse(popularPool.filter(d => d.status !== 'tutup'), {
      keys: ['name', 'nameLow'],
      threshold: 0.35,
      includeScore: true,
    })
    for (const { item } of fuse.search(query.trim())) {
      const doc = item as RawDoc
      if (!seen.has(doc.id)) {
        seen.add(doc.id)
        all.push(doc)
      }
    }

    // Relevance scoring: exact > starts-with-query > all-words-present > word-prefix > fuzzy
    function score(doc: RawDoc): number {
      const name = (doc.nameLow as string) ?? (doc.name as string ?? '').toLowerCase()
      if (name === q) return 100
      if (name.startsWith(q)) return 80
      if (words.length > 1 && words.every(w => name.includes(w))) return 60
      if (words.some(w => name.startsWith(w))) return 40
      return 20
    }

    let filtered = all
    if (opts?.type) {
      filtered = filtered.filter(d => (d.type as string) === opts.type)
    }

    return filtered
      .map(d => ({ doc: d, s: score(d) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 24)
      .map(({ doc }) => parseMangaCard(doc))
  }
}
