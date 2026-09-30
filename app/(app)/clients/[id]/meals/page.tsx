import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MealWeekForm } from '@/components/client/MealWeekForm'
import { MealWeekView } from '@/components/client/MealWeekView'
import { NutritionWeeksForm } from '@/components/client/NutritionWeeksForm'
import { Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getClient } from '@/lib/data/clients'
import { getMealMemos } from '@/lib/data/meals'
import { getNutritionWeeks, recentWeeks } from '@/lib/data/nutrition'
import { addDays, daysEndingAt, weekStartOf } from '@/lib/dates'
import { requireUser } from '@/lib/session'
import { saveMealsAction, saveNutritionAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜食事メモ` }
}

export default async function MealsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const days = daysEndingAt(base, 7)
  const weeks = recentWeeks(base, 5)
  const [memos, nutrition] = await Promise.all([getMealMemos(id, days[0], base), getNutritionWeeks(id, weeks)])
  const nav = 'inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20'

  return (
    <div className="space-y-5">
      <Section
        title="食事メモの入力"
        en="Meal Memo"
        aside={
          <div className="flex items-center gap-1">
            <Link href={`?date=${addDays(base, -7)}`} className={nav}>
              <ChevronLeft className="size-3.5" aria-hidden />
              前の7日
            </Link>
            <Link href={`?date=${addDays(base, 7)}`} className={nav}>
              次の7日
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        }
      >
        <p className="mb-3 text-sm text-ink-2">基準日（来店日）までの7日分です。ヒアリングで聞いた内容をメモしてください。</p>
        <MealWeekForm key={base} action={saveMealsAction.bind(null, id)} days={days} memos={memos} />
      </Section>
      <Section title="週ごとの食事の数字" en="Nutrition">
        <p className="mb-3 text-sm text-ink-2">食事アプリの週平均（平均カロリー・PFC）と、設定カロリーを入れます。体重が停滞していて、この数字が何週間もほぼ同じだと「食事の変化なし」のお知らせが出ます。</p>
        <NutritionWeeksForm key={base} action={saveNutritionAction.bind(null, id)} weeks={weeks} rows={nutrition} thisWeek={weekStartOf(base)} />
      </Section>
      <Section title="7日間の一覧" en="Weekly View">
        <MealWeekView base={base} memos={memos} />
      </Section>
    </div>
  )
}
