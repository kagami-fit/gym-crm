import Link from 'next/link'
import { NotebookPen } from 'lucide-react'
import { BasicData, ChangeGoalLink, ProjectionSummary } from '@/components/client/BodyBlocks'
import { MealWeekView } from '@/components/client/MealWeekView'
import { TalkKindBadge } from '@/components/client/TalkKindBadge'
import { DrawingView } from '@/components/drawing/DrawingView'
import { SessionTable } from '@/components/client/SessionTable'
import { ProjectionChart } from '@/components/charts/ProjectionChart'
import { VolumeCharts } from '@/components/charts/TrainingCharts'
import { WeightTrend } from '@/components/charts/WeightTrend'
import { PlanSummary } from '@/components/plan/PlanSummary'
import { AnsGallery } from '@/components/plan/AnsGallery'
import { ChangeHistory } from '@/components/plan/Summaries'
import { WeightEvaluation } from '@/components/plan/WeightEvaluation'
import { EmptyState, Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getClient } from '@/lib/data/clients'
import { getMealMemos } from '@/lib/data/meals'
import { getNutritionWeeks, recentWeeks } from '@/lib/data/nutrition'
import { getTalkNotes } from '@/lib/data/talk'
import { getBodyView } from '@/lib/data/overview'
import { getPlanView, getWeightReviews } from '@/lib/data/plan'
import { getDrawing, getSessions, lastRecordsBefore } from '@/lib/data/training'
import { addDays, mdw, ymdJa } from '@/lib/dates'
import { policyLabel } from '@/lib/labels'
import { changeHistory } from '@/lib/plan'
import { requireUser } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await getClient(id)
  return { title: `${c.name}｜概要` }
}

/**
 * 概要。上から、現在地 → 自律神経の測定（前回と最新の測定票） → 体重の推移と方針に合わせた評価 → 変更の履歴。
 * （痛み・疲労・不調の経過と動作の達成状況は、2026-10 にいったん外した。あとで見せ方を考えて戻す）
 * そのあとに会話メモ・カロリーの計算・予測（減量のときだけ）・トレーニング・食事メモ。
 */
export default async function ClientOverviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const [view, plan, sessions, meals, talk, reviews, nutrition] = await Promise.all([
    getBodyView(id, base),
    getPlanView(id, base),
    getSessions(id, base),
    getMealMemos(id, addDays(base, -6), base),
    getTalkNotes(id, { upTo: base, take: 6 }),
    getWeightReviews(id),
    getNutritionWeeks(id, recentWeeks(base, 12)),
  ])
  // 直近の「種目の記録がある回」と「手書きメモがある回」（同じ回のこともある）
  const latest = [...sessions].reverse().find((s) => s.rows.length > 0)
  const latestMemo = [...sessions].reverse().find((s) => s.hasDrawing)
  const memoData = latestMemo ? await getDrawing(latestMemo.id) : null
  const q = `?date=${base}`
  const planHref = (anchor: string) => `/clients/${id}/plan${q}#${anchor}`
  const loss = view.goal?.policy === 'loss'
  const policies = [...plan.goals].reverse().map((g) => ({ start: g.startDate, label: policyLabel(g.policy, g.policyName) }))

  const linkClass = 'rounded-full bg-brand px-3 py-1 text-xs font-black text-ink hover:bg-brand-deep'
  const planLink = (anchor: string, label: string) => (
    <Link href={planHref(anchor)} className={linkClass}>
      {label}
    </Link>
  )

  return (
    <div className="space-y-5">
      <Section title="現在地" en="Now" aside={planLink('phase', '指導計画を開く')}>
        <PlanSummary view={plan} clientId={id} />
      </Section>

      <Section title="自律神経の測定" en="ANS" aside={planLink('ans', plan.ans.length ? 'すべて見る・入れる' : '測定結果を入れる')}>
        {plan.ans.length ? (
          <div className="space-y-2">
            <p className="text-sm text-ink-2">左が前回、右が最新です。押すと大きく開きます（「前回と並べる」で並べて見せられます）。</p>
            <div className="max-w-3xl">
              <AnsGallery files={plan.ans} mode="compare" />
            </div>
          </div>
        ) : (
          <EmptyState title="まだ測定結果がありません" action={{ href: planHref('ans'), label: '測定結果を入れる' }}>
            condiView の測定票（PDF・写真）を入れると、ここに前回と並べて出ます
          </EmptyState>
        )}
      </Section>

      <Section
        title="体重の推移と評価"
        en="Body Trend"
        aside={
          <Link href={`/clients/${id}/body${q}`} className={linkClass}>
            体重を入力
          </Link>
        }
      >
        <div className="space-y-5">
          {view.points.length ? (
            <WeightTrend points={view.points} base={base} targetWeight={loss ? (view.goal?.targetWeightKg ?? null) : null} phases={plan.phases} policies={policies} />
          ) : (
            <EmptyState title="まだ体重の記録がありません" action={{ href: `/clients/${id}/body${q}`, label: '体重を入力する' }} />
          )}
          <WeightEvaluation view={view} reviews={reviews} nutrition={Object.values(nutrition)} clientId={id} reviewHref={`/clients/${id}/body${q}#review`} />
        </div>
      </Section>

      <Section title="フェーズ・食事方針の変更履歴" en="History" aside={planLink('policy', '食事方針を変える')}>
        <ChangeHistory items={changeHistory(plan.phases, plan.goals)} />
      </Section>

      <Section
        title="会話メモ（最近）"
        en="Talk Log"
        aside={
          <Link href={`/clients/${id}/talk${q}`} className={linkClass}>
            すべて見る・書く
          </Link>
        }
      >
        {talk.length ? (
          <ul className="divide-y divide-line">
            {talk.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="num w-20 flex-none pt-0.5 text-sm font-semibold text-ink-2">{mdw(n.date)}</span>
                <TalkKindBadge kind={n.kind} className="mt-1 flex-none" />
                <p className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-relaxed">{n.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="まだ会話メモがありません" action={{ href: `/clients/${id}/talk${q}`, label: '会話メモを書く' }}>
            会話で出た変化・良かったこと・気になる言動を、日付と一緒に残せます
          </EmptyState>
        )}
      </Section>

      <Section title="カロリーの計算" en="Basic Data" aside={<span className="text-white/80">基準日 {ymdJa(base)}</span>}>
        <BasicData view={view} clientId={id} />
      </Section>

      {loss && (
        <Section
          title="体重・体脂肪率の予測（減量）"
          en="Forecast"
          aside={
            view.pace ? (
              <span className="flex flex-wrap items-center gap-2 text-white/80">
                減量ペース：{view.pace.name}（現体重の−{view.pace.percentPerMonth}%／月{view.pace.note ? `・${view.pace.note}` : ''}）
                <ChangeGoalLink clientId={id} base={base} />
              </span>
            ) : undefined
          }
        >
          {view.goal?.targetWeightKg != null && view.weight && view.months.length ? (
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
            <EmptyState title="体重と減量の目標がそろうと予測が表示されます" action={{ href: planHref('policy'), label: '食事方針・目標を見る' }} />
          )}
        </Section>
      )}

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
