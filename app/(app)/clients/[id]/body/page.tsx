import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BodyWeekForm } from '@/components/client/BodyForms'
import { WeightEvaluation } from '@/components/plan/WeightEvaluation'
import { WeightReviewPanel } from '@/components/plan/WeightReviewPanel'
import { EmptyState, Section, buttonClass } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getClient } from '@/lib/data/clients'
import { getBodyLogs } from '@/lib/data/body'
import { getNutritionWeeks, recentWeeks } from '@/lib/data/nutrition'
import { getBodyView } from '@/lib/data/overview'
import { getWeightReviews } from '@/lib/data/plan'
import { addDays, daysEndingAt, md, mdw } from '@/lib/dates'
import { num } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { saveBodyWeekAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜体重` }
}

export default async function BodyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const days = daysEndingAt(base, 7)
  const [view, week, history, reviews, nutrition] = await Promise.all([
    getBodyView(id, base),
    getBodyLogs(id, days[0], base),
    getBodyLogs(id, addDays(base, -120), base),
    getWeightReviews(id),
    getNutritionWeeks(id, recentWeeks(base, 12)),
  ])
  const byDate = new Map(week.map((w) => [w.date, w]))
  const before = [...history].reverse().find((h) => h.date < days[0] && h.weightKg != null)

  return (
    <div className="space-y-5">
      <Section
        title="体重・体脂肪率の入力"
        en="Body Log"
        aside={
          <div className="flex items-center gap-1">
            <Link href={`?date=${addDays(base, -7)}`} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20">
              <ChevronLeft className="size-3.5" aria-hidden />
              前の7日
            </Link>
            <Link href={`?date=${addDays(base, 7)}`} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white hover:bg-white/20">
              次の7日
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        }
      >
        <p className="mb-3 text-sm text-ink-2">
          基準日（来店日）までの7日分です。ヒアリングで聞いた体重・体脂肪率をまとめて入力できます。
        </p>
        <BodyWeekForm
          key={base}
          action={saveBodyWeekAction.bind(null, id)}
          prevWeight={before?.weightKg ?? null}
          days={days.map((d) => ({ date: d, weightKg: byDate.get(d)?.weightKg ?? null, bodyFatPct: byDate.get(d)?.bodyFatPct ?? null, note: byDate.get(d)?.note ?? null }))}
        />
      </Section>

      <Section
        title="体重の評価"
        en="Review"
        id="review"
        className="scroll-mt-[calc(var(--client-tabs-h)+12px)]"
        aside={
          <Link href={`/clients/${id}/plan?date=${base}#policy`} className="rounded-full bg-brand px-3 py-1 text-xs font-black text-ink hover:bg-brand-deep">
            食事方針・目標を変える（指導計画）
          </Link>
        }
      >
        <div className="space-y-5">
          <WeightEvaluation view={view} reviews={reviews} nutrition={Object.values(nutrition)} clientId={id} showProgress />
          <div>
            <h3 className="mb-2 text-sm font-black">担当者の評価を記録する</h3>
            <p className="mb-3 text-sm text-ink-2">体重の変化が、いまの方針から見て想定内か・見直しが必要か・まだ評価しないかを、理由と一緒に残します。数字だけで自動では判定しません。</p>
            <WeightReviewPanel key={base} clientId={id} base={base} rows={reviews} />
          </div>
        </div>
      </Section>

      <Section title="記録の一覧（直近4ヶ月）" en="History">
        {history.length === 0 ? (
          <EmptyState title="記録はまだありません" />
        ) : (
          <div className="max-h-96 overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-tint text-left text-xs text-ink-2">
                <tr>
                  <th className="px-3 py-2 font-bold">日付</th>
                  <th className="px-3 py-2 text-right font-bold">体重</th>
                  <th className="px-3 py-2 text-right font-bold">体脂肪率</th>
                  <th className="px-3 py-2 font-bold">メモ</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...history].reverse().map((h) => (
                  <tr key={h.date}>
                    <td className="num px-3 py-1.5">{mdw(h.date)}</td>
                    <td className="num tnum px-3 py-1.5 text-right">{h.weightKg != null ? `${num(h.weightKg)}kg` : '—'}</td>
                    <td className="num tnum px-3 py-1.5 text-right">{h.bodyFatPct != null ? `${num(h.bodyFatPct)}%` : '—'}</td>
                    <td className="px-3 py-1.5 text-ink-2">{h.note ?? ''}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Link href={`?date=${h.date}`} className={buttonClass.small}>
                        {md(h.date)}を基準に
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
