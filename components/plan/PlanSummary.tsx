import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { PlanView } from '@/lib/data/plan'
import { diffDays, md, ymdJa, type Ymd } from '@/lib/dates'
import { num } from '@/lib/format'
import { DIET_POLICIES, isDietPolicy, policyLabel } from '@/lib/labels'
import { ansShort } from '@/lib/plan'
import { phaseDays } from '@/lib/steps'
import { cn } from '@/lib/utils'
import { AnsLevelChip, PhaseChip } from './Chips'

const until = (base: Ymd, d: Ymd) => {
  const n = diffDays(base, d)
  return n > 0 ? `あと${n}日` : n === 0 ? '今日' : `${-n}日過ぎ`
}

function Tile({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: React.ReactNode; warn?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-xl px-3.5 py-2.5', warn ? 'bg-warn-soft' : 'bg-soft')}>
      <p className="text-xs font-bold text-ink-3">{label}</p>
      <div className="mt-0.5 text-base font-black text-ink">{value}</div>
      {sub && <p className={cn('mt-0.5 text-xs', warn ? 'font-bold text-warn' : 'text-ink-3')}>{sub}</p>}
    </div>
  )
}

/**
 * 現在地：いまのフェーズ・食事方針・開始日・目標日・次の見直し、自律神経の状態と確認する点。
 * 予定日を過ぎたもの（コーフラックスの終了予定日・見直し予定日など）があれば、上に出す。
 */
export function PlanSummary({ view }: { view: PlanView }) {
  const { phase, policy, base, ansNow } = view
  const days = phase ? phaseDays(phase, base) : null
  const week = days != null ? Math.floor((days - 1) / 7) + 1 : null
  const pol = policy && isDietPolicy(policy.policy) ? policy : null

  // 次の見直し（基準日以降で一番近い予定日）
  const upcoming = [
    phase?.reviewDate ? { date: phase.reviewDate, label: `${phase.name}の見直し` } : null,
    pol?.reviewDate ? { date: pol.reviewDate, label: '食事方針の見直し' } : null,
    pol?.policy === 'reverse' && pol.endDate ? { date: pol.endDate, label: `${DIET_POLICIES.reverse.label}の終了予定` } : null,
  ]
    .filter((x): x is { date: Ymd; label: string } => !!x && x.date >= base)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0]

  const policySub = pol
    ? [
        `${md(pol.startDate)}から`,
        pol.policy === 'reverse' && pol.endDate ? `終了予定 ${md(pol.endDate)}（${until(base, pol.endDate)}）` : null,
        (pol.policy === 'loss' || pol.policy === 'maintain') && pol.targetWeightKg != null ? `${pol.policy === 'loss' ? '目標' : '維持'} ${num(pol.targetWeightKg)}kg` : null,
      ]
        .filter(Boolean)
        .join('・')
    : null
  const reverseOver = pol?.policy === 'reverse' && pol.endDate != null && pol.endDate < base

  return (
    <div className="space-y-3">
      {view.overdue.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-2.5 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden />
          <p>
            <span className="font-black">予定日を過ぎています：</span>
            {view.overdue.map((o) => `${o.label}を${o.days}日過ぎ`).join('／')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {phase ? <PhaseChip name={phase.name} color={phase.color} withSub big /> : <Badge tone="muted">フェーズ未設定</Badge>}
        {phase && (
          <span className="text-sm text-ink-2">
            <span className="num">{md(phase.start)}</span>から・<span className="num font-bold">{week}</span>週目
          </span>
        )}
        <span className="text-sm text-ink-2">
          来店 {phase?.visitFrequency ?? <span className="text-ink-3">頻度未設定</span>}
          {view.visitsPerWeek != null && <span className="text-ink-3">（実績 週{num(view.visitsPerWeek)}回・直近8週）</span>}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Tile label="食事方針" value={pol ? policyLabel(pol.policy, pol.policyName) : <span className="text-ink-3">未設定</span>} sub={policySub ?? '指導計画のタブで決められます'} warn={reverseOver} />
        <Tile label="目標日" value={pol?.targetDate ? <span className="num">{ymdJa(pol.targetDate, false)}</span> : <span className="text-ink-3">—</span>} sub={pol?.targetDate ? until(base, pol.targetDate) : undefined} warn={!!pol?.targetDate && pol.targetDate < base} />
        <Tile label="次の見直し" value={upcoming ? <span className="num">{md(upcoming.date)}</span> : <span className="text-ink-3">—</span>} sub={upcoming ? `${upcoming.label}・${until(base, upcoming.date)}` : '見直し予定日は未設定'} />
      </div>

      <dl className="grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-sm font-bold text-ink-3">自律神経</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {ansNow.latest ? (
            <>
              <span>{ansShort(ansNow.latest)}</span>
              <span className="inline-flex gap-1">
                <AnsLevelChip level={ansNow.latest.sympatheticLevel} />
                <AnsLevelChip level={ansNow.latest.parasympatheticLevel} />
              </span>
              <span className="num text-xs text-ink-3">{md(ansNow.latest.measuredOn)}の測定</span>
            </>
          ) : (
            <span className="text-ink-3">未評価（測定結果がまだありません）</span>
          )}
        </dd>
        <dt className="text-sm font-bold text-ink-3">確認する点</dt>
        <dd className="min-w-0">{view.checkpoints.join('・')}</dd>
      </dl>
    </div>
  )
}
