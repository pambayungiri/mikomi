import { runQuery } from '../firestore'
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

  async getList(opts: {
    genre?: string
    sort?: 'update' | 'create'
    after?: string
  }): Promise<PaginatedResult<MangaCard>> {
    const orderField = opts.sort === 'create' ? 'CreateAt' : 'UpdateAt'

    // Genre filter: no orderBy (avoids composite index requirement)
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
    const hasMore = docs.length === 36
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
    if (!chapterData || !chapterData.img?.length) {
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

  async search(query: string): Promise<MangaCard[]> {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    const docs = await runQuery({
      from: [{ collectionId: 'KomikApp' }],
      orderBy: [{ field: { fieldPath: 'nameLow' }, direction: 'ASCENDING' }],
      startAt: { values: [{ stringValue: q }], before: true },
      endAt: { values: [{ stringValue: q + '' }], before: false },
      limit: 8,
    })
    return docs.filter(d => d.status !== 'tutup').map(parseMangaCard)
  }
}
