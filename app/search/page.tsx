import { redirect } from 'next/navigation'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>
}) {
  const { q, type } = await searchParams
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (type) params.set('type', type)
  const qs = params.toString()
  redirect(`/list${qs ? `?${qs}` : ''}`)
}
