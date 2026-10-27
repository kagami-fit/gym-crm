import Link from 'next/link'
import { Badge } from '@/components/ui'
import type { WeightReviewRow } from '@/lib/data/plan'
import type { NutritionRow } from '@/lib/data/nutrition'
import type { BodyView } from '@/lib/data/overview'
import { addDays, diffDays, md, weekStartOf, ymdJa, type Ymd } from '@/lib/dates'
import { int, num, signed } from '@/lib/format'
import { DIET_POLICIES, WEIGHT_VERDICTS, policyLabel } from '@/lib/labels'
import { FAST_WEEKLY_PCT, GUIDE_DAYS, GUIDE_PCT, lossGuide, reversePeriods, weeklyChange, weightChangePct } from '@/lib/plan'
import { cn } from '@/lib/utils'

const pctText = (pct: number) => (Math.abs(pct) < 0.05 ? '変化なし' : pct > 0 ? `${num(pct)}%減` : `${num(-pct)}%増`)
const left = (base: Ymd, d: Ymd) => {
  const n = diffDays(base, d)
  return n > 0 ? `あと${n}日` : n === 0 ? '今日' : `${-n}日過ぎ`
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className={cn('rounded-xl border px-4 py-3', tone === 'warn' ? 'border-warn/30 bg-warn-soft' : 'border-line bg-soft')}>
      <p className="text-xs font-bold text-ink-2">{label}</p>
      <p className="num mt-1 text-xl font-semibold text-ink">{value}</p>
      {sub && <p className={cn('mt-0.5 text-xs', tone === 'warn' ? 'font-bold text-warn' : 'text-ink-3')}>{sub}</p>}
    </div>
  )
}

/** その日以前で一番新しい体重（なければその日以降で一番古い体重） */
function weightNear(points: BodyView['points'], day: Ymd): number | null {
  const withW = points.filter((p) => p.weightKg != null)
  return [...withW].reverse().find((p) => p.date <= day)?.weightKg ?? withW.find((p) => p.date >= day)?.weightKg ?? null
}

/** 減量の進み具合（開始 → いま → 目標の帯と、何kg減ったか・あと何kgか・達成率） */
function LossProgress({ pr }: { pr: NonNullable<BodyView['progress']> }) {
  const reached = pr.remainingKg <= 0
  const pct = pr.progressPct
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-ink-3">開始（{md(pr.startDate)}）</p>
          <p className="num text-xl font-semibold">{num(pr.startWeightKg)}kg</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-ink-3">いま</p>
          <p className="num text-3xl font-black">{num(pr.currentWeightKg)}kg</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-ink-3">目標</p>
          <p className="num text-xl font-semibold">{num(pr.targetWeightKg)}kg</p>
        </div>
      </div>
      <div className="mt-3 h-4 rounded-full bg-brand-soft ring-1 ring-inset ring-brand-deep/40" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct ?? 0)} aria-label="目標までの達成率">
        <div className="h-4 rounded-full bg-gold" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className="mt-3 text-lg font-black">
        {reached ? (
          '目標体重に届きました'
        ) : pr.achievedKg >= 0 ? (
          <>
            開始から <span className="num">{num(pr.achievedKg)}kg</span> 減りました
          </>
        ) : (
          <>
            開始から <span className="num">{num(-pr.achievedKg)}kg</span> 増えています
          </>
        )}
        {!reached && (
          <span className="ml-2 text-base font-bold text-ink-2">
            目標まで あと <span className="num">{num(pr.remainingKg)}kg</span>
          </span>
        )}
      </p>
      {pct != null && !reached && (
        <p className="text-sm text-ink-2">
          減らしたい <span className="num">{num(pr.totalKg)}kg</span> のうち <span className="num font-bold text-ink">{Math.round(pct)}%</span>（達成率）
        </p>
      )}
    </div>
  )
}

/**
 * 体重の評価（いまの食事方針に合わせて出し分ける）。
 * - 減量：開始→いま→目標の帯（何kg減ったか・あと何kg・達成率）、予定ペースとの差、このペースで続けた場合の見込み日、週の変化（週1%以上の減少は「速すぎないか確認」）、「3ヶ月で5%」の参考、計算のしかた
 * - コーフラックス：終了予定日・目標日までの期間、体重を増やさずに摂取カロリーを上げられているか
 * - 維持：維持したい体重との差
 * - フェーズ1の方針：方針の開始からの変化だけ（減量の目安は使わない）
 * どれも自動で「遅れ」「失敗」とは判定しない。判断は担当者の評価として残す。
 */
export function WeightEvaluation({
  view,
  reviews,
  nutrition = [],
  clientId,
  reviewHref,
}: {
  view: BodyView
  reviews: WeightReviewRow[]
  nutrition?: NutritionRow[]
  clientId: string
  reviewHref?: string
}) {
  const g = view.goal
  const cur = view.weight
  const base = view.base
  const weekly = weeklyChange(view.points, base)
  const latestReview = reviews[0] ?? null

  if (!g) {
    return (
      <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">
        食事方針が未設定です
        <Link href={`/clients/${clientId}/plan?date=${base}#policy`} className="ml-2 font-bold text-brand-ink underline underline-offset-2">
          指導計画で決める
        </Link>
      </p>
    )
  }
  const startW = g.startWeightKg ?? weightNear(view.points, g.startDate)
  const name = policyLabel(g.policy, g.policyName)
  const sinceStart = startW != null && cur ? { kg: cur.value - startW, pct: weightChangePct(startW, cur.value) } : null
  const weekTile = (flag: boolean) =>
    weekly ? (
      <Tile
        label="直近の週の変化（7日前と比べて）"
        value={`${signed(weekly.to - weekly.from)}kg`}
        sub={
          <>
            <span className="num">
              {md(weekly.prevDate)} → {md(weekly.date)}・{pctText(weekly.pct)}
            </span>
            {flag && weekly.fast && <span className="block">週{FAST_WEEKLY_PCT}%以上の減少：速すぎないか確認</span>}
          </>
        }
        tone={flag && weekly.fast ? 'warn' : undefined}
      />
    ) : (
      <Tile label="直近の週の変化" value="—" sub="直近4週間に、7日前と比べられる記録がありません" />
    )

  let body: React.ReactNode
  if (g.policy === 'loss') {
    const pr = view.progress
    const pace = view.pace
    const reached = !!pr && pr.remainingKg <= 0
    const goalDate = view.plan.daysToGoal != null ? addDays(base, Math.ceil(view.plan.daysToGoal)) : null
    const guide = startW != null && cur ? lossGuide(startW, g.startDate, { weightKg: cur.value, date: cur.date }) : null
    const behind = !!pr && pr.aheadKg <= -0.05
    body = (
      <div className="space-y-4">
        {pr ? <LossProgress pr={pr} /> : <p className="rounded-xl border border-dashed border-line-2 bg-soft px-4 py-5 text-center text-sm text-ink-2">目標体重・減量ペースと体重の記録がそろうと、進み具合が出ます</p>}
        {pr && !reached && (
          <div className="grid gap-3 md:grid-cols-3">
            <Tile
              label="予定ペースとの差"
              value={Math.abs(pr.aheadKg) < 0.05 ? '予定どおり' : `予定より ${num(Math.abs(pr.aheadKg))}kg ${pr.aheadKg > 0 ? '先行' : '遅れ'}`}
              sub={pace ? `${pace.name}（月−${pace.percentPerMonth}%）どおりなら、今日は ${num(pr.plannedWeightKg)}kg` : undefined}
              tone={behind ? 'warn' : undefined}
            />
            <Tile
              label="このペースで続けると"
              value={goalDate ? `${ymdJa(goalDate, false)}ごろ` : '—'}
              sub={goalDate ? `目標まで あと${diffDays(base, goalDate)}日（いまの体重から${pace ? `${pace.name}のペース` : ''}で計算）${pr.plannedGoalDate ? `。開始時の見込みは ${md(pr.plannedGoalDate)}` : ''}` : undefined}
            />
            {weekTile(true)}
          </div>
        )}
        {guide && (
          <p className="text-sm text-ink-2">
            <span className="font-bold text-ink">参考：3ヶ月で{GUIDE_PCT}%</span>（会議の目安）…開始 <span className="num">{num(startW)}kg</span> なら <span className="num">−{num(guide.guideKg)}kg</span>（<span className="num">{num(guide.guideWeightKg)}kg</span>）、3ヶ月は <span className="num">{md(addDays(g.startDate, GUIDE_DAYS))}</span> ごろ。いまは開始から <span className="num">{pctText(guide.changePct)}</span>。届かなくても遅れとはしません
          </p>
        )}
        <details className="rounded-xl bg-soft px-4 py-2.5 text-sm text-ink-2">
          <summary className="cursor-pointer font-bold text-ink">計算のしかた</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>達成率 ＝（開始の体重 − いまの体重）÷（開始の体重 − 目標体重）</li>
            <li>予定の体重 ＝ 開始の体重 −（開始の体重 × 減量ペース％ ÷ 30日）× 開始からの日数</li>
            <li>このペースで続けると ＝ 目標まであと何kg ÷（いまの体重 × 減量ペース％ ÷ 30日）日後</li>
            <li>直近の週の変化 ＝ ちょうど7日前の記録との差。減少率 ＝（7日前 − いま）÷ 7日前 × 100。7日と違う間隔の記録は使いません</li>
          </ul>
        </details>
      </div>
    )
  } else if (g.policy === 'reverse') {
    const rp = reversePeriods(base, g.endDate, g.targetDate)
    const from = weekStartOf(g.startDate)
    const weeks = nutrition.filter((n) => n.weekStart >= from && (n.avgKcal != null || n.targetKcal != null)).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    body = (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Tile label="終了予定日" value={g.endDate ? md(g.endDate) : '—'} sub={g.endDate ? left(base, g.endDate) : '終了予定日を決めてください'} tone={rp.toEnd != null && rp.toEnd < 0 ? 'warn' : undefined} />
          <Tile label="目標日" value={g.targetDate ? md(g.targetDate) : '—'} sub={g.targetDate ? `${left(base, g.targetDate)}${rp.afterEnd != null ? `・終了後 約${Math.round(rp.afterEnd / 7)}週を減量に使える` : ''}` : '未設定'} />
          <Tile label={`${DIET_POLICIES.reverse.label}の開始から`} value={sinceStart ? `${signed(sinceStart.kg)}kg` : '—'} sub={sinceStart ? <span className="num">{`${pctText(sinceStart.pct)}・開始 ${num(startW)}kg（${md(g.startDate)}）`}</span> : '体重の記録がそろうと出ます'} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-black">摂取カロリーと体重（週ごと）</p>
          {weeks.length ? (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-tint text-left text-xs text-ink-2">
                  <tr>
                    <th className="px-3 py-2 font-bold">週</th>
                    <th className="px-3 py-2 text-right font-bold">設定カロリー</th>
                    <th className="px-3 py-2 text-right font-bold">平均カロリー</th>
                    <th className="px-3 py-2 text-right font-bold">体重（週平均）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {weeks.map((w) => {
                    const ws = view.points.filter((p) => p.weightKg != null && p.date >= w.weekStart && p.date <= addDays(w.weekStart, 6)).map((p) => p.weightKg as number)
                    const avg = ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null
                    return (
                      <tr key={w.weekStart}>
                        <td className="num px-3 py-1.5">{md(w.weekStart)}〜</td>
                        <td className="num tnum px-3 py-1.5 text-right">{w.targetKcal != null ? `${int(w.targetKcal)}kcal` : '—'}</td>
                        <td className="num tnum px-3 py-1.5 text-right font-semibold">{w.avgKcal != null ? `${int(w.avgKcal)}kcal` : '—'}</td>
                        <td className="num tnum px-3 py-1.5 text-right">{avg != null ? `${num(avg)}kg` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-3">この方針の期間の「週ごとの食事の数字」はまだありません（食事メモのタブで入れられます）</p>
          )}
        </div>
      </div>
    )
  } else if (g.policy === 'maintain') {
    const diff = g.targetWeightKg != null && cur ? cur.value - g.targetWeightKg : null
    body = (
      <div className="grid gap-3 md:grid-cols-3">
        <Tile label="維持したい体重" value={g.targetWeightKg != null ? `${num(g.targetWeightKg)}kg` : '—'} sub={g.targetWeightKg == null ? (g.note ? `状態：${g.note}` : '未設定') : undefined} />
        <Tile label="いまの差" value={diff != null ? `${signed(diff)}kg` : '—'} sub={cur ? <span className="num">{`現在 ${num(cur.value)}kg（${md(cur.date)}）`}</span> : undefined} />
        {weekTile(false)}
      </div>
    )
  } else {
    body = (
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Tile label={`${name}の開始から`} value={sinceStart ? `${signed(sinceStart.kg)}kg` : '—'} sub={sinceStart ? <span className="num">{`${pctText(sinceStart.pct)}・開始 ${num(startW)}kg（${md(g.startDate)}）`}</span> : '体重の記録がそろうと出ます'} />
          {weekTile(false)}
          <Tile label="現在" value={cur ? `${num(cur.value)}kg` : '—'} sub={cur ? md(cur.date) : undefined} />
        </div>
        <p className="text-xs text-ink-3">体を整える方針のあいだは、減量の目安（3ヶ月で{GUIDE_PCT}%・予定ペース）は使いません。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        いまの食事方針：<span className="font-black text-ink">{name}</span>
        <span className="num ml-1 text-ink-3">（{md(g.startDate)}から）</span>
      </p>
      {body}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line px-4 py-3">
        <span className="text-sm font-black">担当者の評価</span>
        {latestReview ? (
          <>
            <Badge tone={WEIGHT_VERDICTS[latestReview.verdict].tone}>{WEIGHT_VERDICTS[latestReview.verdict].label}</Badge>
            <span className="num text-xs text-ink-3">{md(latestReview.date)}</span>
            {latestReview.reason && <span className="min-w-0 flex-1 text-sm text-ink-2">{latestReview.reason}</span>}
          </>
        ) : (
          <span className="text-sm text-ink-3">まだありません</span>
        )}
        {reviewHref && (
          <Link href={reviewHref} className="ml-auto text-sm font-bold text-brand-ink underline-offset-2 hover:underline">
            評価を記録する
          </Link>
        )}
      </div>
    </div>
  )
}
