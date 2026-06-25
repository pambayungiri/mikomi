import { NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; num: string }> }
) {
  try {
    const { slug, num } = await params
    const chapter = parseInt(num, 10)
    if (isNaN(chapter)) return NextResponse.json({ error: 'Invalid chapter' }, { status: 400 })

    const provider = getProvider()
    const data = await provider.getChapter(slug, chapter)
    return NextResponse.json({ pages: data.pages })
  } catch {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  }
}
