import Link from 'next/link'
import { NotebookPen } from 'lucide-react'
import { BasicData, ChangeGoalLink, GoalProgress, ProjectionSummary } from '@/components/client/BodyBlocks'
import { MealWeekView } from '@/components/client/MealWeekView'
import { DrawingView } from '@/components/drawing/DrawingView'
import { SessionTable } from '@/components/client/SessionTable'
import { ProjectionChart } from '@/components/charts/ProjectionChart'
import { VolumeCharts } from '@/components/charts/TrainingCharts'
import { WeightTrend } from '@/components/charts/WeightTrend'
import { EmptyState, Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getClient } from '@/lib/data/clients'
import { getMealMemos } from '@/lib/data/meals'
import { getBodyView } from '@/lib/data/overview'
import { getDrawing, getSessions, lastRecordsBefore } from '@/lib/data/training'
import { addDays, mdw, ymdJa } from '@/lib/dates'
import { requireUser } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await getClient(id)
  return { title: `${c.name}｜概要` }
}

export default async function ClientOverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const [view, sessions, meals] = await Promise.all([getBodyView(id, base), getSessions(id, base), getMealMemos(id, addDays(base, -6), base)])
  // 直近の「種目の記録がある回」と「手書きメモがある回」（同じ回のこともある）
  const latest = [...sessions].reverse().find((s) => s.rows.length > 0)
  const latestMemo = [...sessions].reverse().find((s) => s.hasDrawing)
  const memoData = latestMemo ? await getDrawing(latestMemo.id) : null
  const q = `?date=${base}`

  const linkClass = 'rounded-full bg-brand px-3 py-1 text-xs font-black text-ink hover:bg-brand-deep'

  return (
    <div className="space-y-5">
      <Section title="基本データ" en="Basic Data" aside={<span className="text-white/80">基準日 {ymdJa(base)}</span>}>
        <BasicData view={view} clientId={id} />
      </Section>

      <Section title="目標の進捗" en="Progress" aside={view.goal ? <ChangeGoalLink clientId={id} base={base} /> : undefined}>
        <GoalProgress view={view} clientId={id} />
      </Section>

      <Section
        title="体重・体脂肪率の推移"
        en="Body Trend"
        aside={
          <Link href={`/clients/${id}/body${q}`} className={linkClass}>
            体重を入力
          </Link>
        }
      >
        {view.points.length ? (
          <WeightTrend points={view.points} base={base} targetWeight={view.goal?.targetWeightKg ?? null} />
        ) : (
          <EmptyState title="まだ体重の記録がありません" action={{ href: `/clients/${id}/body${q}`, label: '体重を入力する' }} />
        )}
      </Section>

      <Section
        title="体重・体脂肪率の予測"
        en="Forecast"
        aside={
          view.pace ? (
            <span className="text-white/80">
              減量ペース：{view.pace.name}（現体重の−{view.pace.percentPerMonth}%／月{view.pace.note ? `・${view.pace.note}` : ''}）
            </span>
          ) : undefined
        }
      >
        {view.goal && view.weight && view.months.length ? (
          <div className="space-y-4">
            <ProjectionSummary view={view} />
            <ProjectionChart
              base={base}
              current={{ weightKg: view.weight.value, bodyFatPct: view.bodyFat?.value ?? null, fatMassKg: view.plan.composition.fatMassKg }}
              targetWeight={view.goal.targetWeightKg}
              month={view.months}
              week={view.weeks}
            />
          </div>
        ) : (
          <EmptyState title="体重と目標がそろうと予測が表示されます" action={{ href: `/clients/${id}/body${q}`, label: '体重・目標を入力する' }} />
        )}
      </Section>

      <Section
        title="トレーニング"
        en="Training"
        aside={
          <Link href={`/clients/${id}/training${q}`} className={linkClass}>
            記録・部位別の推移を見る
          </Link>
        }
      >
        <div className="space-y-4">
          <VolumeCharts sessions={sessions} base={base} count={view.settings.recentSessionCount} />
          {latest && (
            <div>
              <p className="mb-2 text-sm font-black text-ink">
                直近のトレーニング <span className="num ml-1 font-semibold text-ink-2">{mdw(latest.date)}</span>
                {latest.trainerName && <span className="ml-2 text-xs font-bold text-ink-3">担当 {latest.trainerName}</span>}
              </p>
              <SessionTable session={latest} method={view.settings.oneRmMethod} previous={lastRecordsBefore(sessions, latest.date)} />
              {latest.memo && <p className="mt-2 rounded-lg bg-soft px-3 py-2 text-sm text-ink-2">メモ：{latest.memo}</p>}
            </div>
          )}
          {latestMemo && memoData && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-ink">
                  直近の手書きメモ <span className="num ml-1 font-semibold text-ink-2">{mdw(latestMemo.date)}</span>
                </p>
                <Link href={`/memo/${latestMemo.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-2 bg-white px-3.5 text-sm font-bold text-ink-2 hover:bg-soft">
                  <NotebookPen className="size-4" aria-hidden />
                  開いて書き足す
                </Link>
              </div>
              <Link href={`/memo/${latestMemo.id}`} className="block rounded-xl hover:ring-2 hover:ring-brand-deep" aria-label="手書きメモを開く">
                <DrawingView data={memoData} maxPages={2} />
              </Link>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="食事メモ（直近7日）"
        en="Meal Memo"
        aside={
          <Link href={`/clients/${id}/meals${q}`} className={linkClass}>
            食事メモを書く
          </Link>
        }
      >
        <MealWeekView base={base} memos={meals} />
      </Section>
    </div>
  )
}
