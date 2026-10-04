import Link from 'next/link'
import { GoalProgress } from '@/components/client/BodyBlocks'
import { Badge } from '@/components/ui'
import type { WeightReviewRow } from '@/lib/data/plan'
import type { NutritionRow } from '@/lib/data/nutrition'
import type { BodyView } from '@/lib/data/overview'
import { addDays, diffDays, md, weekStartOf, type Ymd } from '@/lib/dates'
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

/**
 * 体重の評価（いまの食事方針に合わせて出し分ける）。
 * - 減量：開始体重との差と変化率、「3ヶ月で5%」の参考目安、週の変化（週1%以上の減少は「速すぎないか確認」）、予定ペースとの差
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
  showProgress,
  reviewHref,
}: {
  view: BodyView
  reviews: WeightReviewRow[]
  nutrition?: NutritionRow[]
  clientId: string
  showProgress?: boolean
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
    const guide = startW != null && cur ? lossGuide(startW, g.startDate, { weightKg: cur.value, date: cur.date }) : null
    body = (
      <div className="space-y-4">
        {showProgress && view.progress && <GoalProgress view={view} clientId={clientId} />}
        <div className="grid gap-3 md:grid-cols-3">
          <Tile
            label={`${name}の開始から`}
            value={guide ? `${signed(-guide.changeKg)}kg` : '—'}
            sub={guide ? <span className="num">{`${pctText(guide.changePct)}・開始 ${num(startW)}kg（${md(g.startDate)}）・${Math.max(1, Math.round(guide.elapsedDays / 7))}週`}</span> : '体重の記録がそろうと出ます'}
          />
          <Tile
            label={`参考：3ヶ月で${GUIDE_PCT}%`}
            value={guide ? `−${num(guide.guideKg)}kg` : '—'}
            sub={guide ? <span className="num">{`開始 ${num(startW)}kg なら ${num(guide.guideWeightKg)}kg・3ヶ月は ${md(addDays(g.startDate, GUIDE_DAYS))} ごろ`}</span> : undefined}
          />
          {weekTile(true)}
        </div>
        <p className="text-xs text-ink-3">3ヶ月で{GUIDE_PCT}%は会議で出た参考の目安です。全員の目標ではなく、届かないことだけで遅れとは判定しません。7日と違う間隔の記録は週の変化に使いません。</p>
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
