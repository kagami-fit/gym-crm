import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BodyWeekForm, DeleteGoalButton, GoalForm } from '@/components/client/BodyForms'
import { Badge, EmptyState, Section, buttonClass } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { findPace, activityLabel } from '@/lib/calc/settings'
import { getClient } from '@/lib/data/clients'
import { getBodyLogs } from '@/lib/data/body'
import { getBodyView } from '@/lib/data/overview'
import { addDays, daysEndingAt, md, mdw, ymdJa } from '@/lib/dates'
import { num } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { addGoalAction, deleteGoalAction, saveBodyWeekAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜体重・目標` }
}

export default async function BodyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const days = daysEndingAt(base, 7)
  const [view, week, history] = await Promise.all([getBodyView(id, base), getBodyLogs(id, days[0], base), getBodyLogs(id, addDays(base, -120), base)])
  const byDate = new Map(week.map((w) => [w.date, w]))
  const before = [...history].reverse().find((h) => h.date < days[0] && h.weightKg != null)
  const { settings, goal, goals } = view
  const pace = goal ? findPace(settings, goal.paceKey) : null

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

      <Section title="目標設定" en="Goal" id="goal">
        {goal ? (
          <div className="mb-5 grid gap-3 rounded-xl border border-line bg-soft p-4 sm:grid-cols-2 lg:grid-cols-5">
            <Item label="現在の目標（開始日）" value={ymdJa(goal.startDate)} />
            <Item label="目標体重" value={`${num(goal.targetWeightKg)} kg`} />
            <Item label="減量ペース" value={pace ? `${pace.name}（−${pace.percentPerMonth}%／月）` : '設定から削除されたペース'} warn={!pace} />
            <Item label="活動係数" value={`${num(goal.activityFactor)}`} sub={activityLabel(settings, goal.activityFactor)} />
            <Item label="開始時" value={goal.startWeightKg != null ? `${num(goal.startWeightKg)} kg` : '—'} sub={goal.startBodyFatPct != null ? `体脂肪率 ${num(goal.startBodyFatPct)}%` : undefined} />
          </div>
        ) : (
          <div className="mb-5">
            <EmptyState title="まだ目標がありません。下のフォームで設定してください" />
          </div>
        )}
        <h3 className="mb-3 text-sm font-black">{goal ? '目標を変更する（履歴に追加されます）' : '目標を設定する'}</h3>
        <GoalForm
          key={base}
          action={addGoalAction.bind(null, id)}
          paces={settings.paces}
          activityFactors={settings.activityFactors}
          defaults={{ startDate: base, targetWeightKg: goal?.targetWeightKg ?? null, paceKey: goal?.paceKey ?? null, activityFactor: goal?.activityFactor ?? null }}
        />

        {goals.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-black">目標の履歴</h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-tint text-left text-xs text-ink-2">
                  <tr>
                    <th className="px-3 py-2 font-bold">開始日</th>
                    <th className="px-3 py-2 text-right font-bold">開始時</th>
                    <th className="px-3 py-2 text-right font-bold">目標体重</th>
                    <th className="px-3 py-2 font-bold">ペース</th>
                    <th className="px-3 py-2 text-right font-bold">活動係数</th>
                    <th className="px-3 py-2 font-bold">メモ</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {goals.map((g) => (
                    <tr key={g.id}>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="num">{ymdJa(g.startDate, false)}</span>
                        {g.id === goal?.id && (
                          <Badge tone="brand" className="ml-2">
                            基準日に有効
                          </Badge>
                        )}
                      </td>
                      <td className="num tnum px-3 py-2 text-right">{g.startWeightKg != null ? `${num(g.startWeightKg)}kg` : '—'}</td>
                      <td className="num tnum px-3 py-2 text-right font-semibold">{num(g.targetWeightKg)}kg</td>
                      <td className="px-3 py-2">{findPace(settings, g.paceKey)?.name ?? '—'}</td>
                      <td className="num tnum px-3 py-2 text-right">{num(g.activityFactor)}</td>
                      <td className="px-3 py-2 text-ink-2">{g.note ?? ''}</td>
                      <td className="px-2 py-1">
                        <DeleteGoalButton action={deleteGoalAction.bind(null, id, g.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

function Item({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold text-ink-3">{label}</p>
      <p className={`num mt-0.5 font-semibold ${warn ? 'text-danger' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-ink-3">{sub}</p>}
    </div>
  )
}
