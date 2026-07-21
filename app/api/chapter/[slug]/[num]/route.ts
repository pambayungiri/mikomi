import { NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; num: string }> }
) {
  try {
    const { slug, num } = await params
    const chapter = Number(num)
    if (isNaN(chapter)) return NextResponse.json({ error: 'Invalid chapter' }, { status: 400 })

    const provider = getProvider()
    const data = await provider.getChapter(slug, chapter)
    return NextResponse.json({
      chapter: data.chapter,
      pages:   data.pages,
      prev:    data.prev,
      next:    data.next,
    }, {
      // CDN-cache successful lookups — chapter contents are effectively immutable
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    })
  } catch (e) {
    console.error('[route debug] getChapter threw:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  }
}
