import { notFound } from 'next/navigation'
import { getProvider } from '@/lib/providers'
import ChapterReader from '@/components/ChapterReader'
import HistoryTracker from '@/components/HistoryTracker'

export const revalidate = 86400

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>
}) {
  const { slug, chapter: chapterStr } = await params
  const chapter = Number(chapterStr)

  if (isNaN(chapter)) notFound()

  const provider = getProvider()
  let data
  try {
    data = await provider.getChapter(slug, chapter)
  } catch {
    notFound()
  }

  return (
    <div>
      <HistoryTracker
        slug={slug}
        chapter={chapter}
        mangaName={data.mangaName}
        mangaImage={data.mangaImage}
      />
      <ChapterReader
        pages={data.pages}
        slug={slug}
        chapter={chapter}
        prev={data.prev}
        next={data.next}
        mangaName={data.mangaName}
      />
    </div>
  )
}
