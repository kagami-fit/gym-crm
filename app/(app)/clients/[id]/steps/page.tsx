import { redirect } from 'next/navigation'

/** 旧「ステップ」のページ（2026-10-04 に「指導計画」へ名前を変えた）。前のリンクから来たら指導計画へ */
export default async function StepsRedirect({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params
  const { date } = await searchParams
  redirect(`/clients/${id}/plan${date ? `?date=${encodeURIComponent(date)}` : ''}`)
}
