export type MangaCard = {
  id: string
  slug: string
  name: string
  type: string           // "Manga" | "Manhwa" | "Manhua"
  image: string
  latestChapter: number | null
  updatedAt: string      // ISO timestamp string
}

export type ChapterMeta = {
  number: number
  updatedAt: string
  note: string
}

export type MangaDetail = MangaCard & {
  name2: string
  description: string
  genre: string[]
  demographic: string[]
  themes: string[]
  author: string
  artist: string
  rate: number
  status: string         // "Ongoing" | "Completed" | "Hiatus"
  rilis: string
  chapters: ChapterMeta[]
}

export type ChapterDetail = {
  mangaSlug: string
  mangaName: string
  mangaImage: string
  chapter: number
  pages: string[]
  prev: number | null
  next: number | null
}

export type PaginatedResult<T> = {
  data: T[]
  nextCursor: string | null  // ISO timestamp of last item's UpdateAt for startAfter
  hasMore: boolean
}

export interface MangaProvider {
  getPopular(): Promise<MangaCard[]>
  getLatestUpdate(): Promise<MangaCard[]>
  getNewArrivals(): Promise<MangaCard[]>
  getList(opts: {
    genre?: string
    sort?: 'update' | 'create' | 'rating'
    type?: string
    after?: string
  }): Promise<PaginatedResult<MangaCard>>
  getManga(slug: string): Promise<MangaDetail>
  getChapter(slug: string, chapter: number): Promise<ChapterDetail>
  search(query: string, opts?: { type?: string }): Promise<MangaCard[]>
  getPopularByType(type: string): Promise<MangaCard[]>
  getGenres(): string[]
}
