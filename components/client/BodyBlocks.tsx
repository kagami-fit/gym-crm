import Link from 'next/link'
import { Badge, EmptyState, Notice, Value } from '@/components/ui'
import { PfcDonut } from '@/components/charts/PfcDonut'
import { BMR_METHODS, activityLabel } from '@/lib/calc/settings'
import { addDays, diffDays, md, ymdJa } from '@/lib/dates'
import { int, num, signed } from '@/lib/format'
import type { BodyView } from '@/lib/data/overview'
import { cn } from '@/lib/utils'

/** 参考シートの「紺のラベル｜数値｜単位」の行 */
function DataRow({ label, value, unit, sub, subTone, emphasis }: { label: string; value: string; unit?: string; sub?: React.ReactNode; subTone?: 'danger' | 'ok'; emphasis?: boolean }) {
  return (
    <div className="grid min-h-11 grid-cols-[7.5rem_1fr] overflow-hidden rounded-lg sm:grid-cols-[8.5rem_1fr]">
      <div className={cn('flex items-center px-3 py-2 text-[13px] font-bold', emphasis ? 'bg-brand text-ink' : 'bg-dark-2 text-white')}>{label}</div>
      <div className={cn('flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-1.5', emphasis ? 'bg-brand-soft' : 'bg-soft')}>
        <Value value={value} unit={unit} className={cn('text-xl text-ink', emphasis && 'text-2xl')} />
        {sub && <span className={cn('text-xs text-ink-3', subTone === 'danger' && 'font-bold text-danger', subTone === 'ok' && 'font-bold text-ok')}>{sub}</span>}
      </div>
    </div>
  )
}

export function BasicData({ view, clientId }: { view: BodyView; clientId: string | null }) {
  const { plan: p, weight, bodyFat, goal, pace, settings } = view
  const comp = p.composition
  const toTarget = weight && goal ? weight.value - goal.targetWeightKg : null
  const bodyHref = clientId ? `/clients/${clientId}/body?date=${view.base}` : null

  return (
    <div className="space-y-4">
      {!weight && (
        <Notice tone="info">
          {bodyHref ? '基準日までの体重の記録がありません。' : '体重を入れてください。'}
          {bodyHref && (
            <Link href={bodyHref} className="ml-1 font-bold underline">
              体重・目標タブで入力
            </Link>
          )}
        </Notice>
      )}
      {weight && !goal && (
        <Notice tone="info">
          目標が未設定のため、目標カロリーと予測は表示されません。
          {bodyHref && (
            <Link href={bodyHref} className="ml-1 font-bold underline">
              目標を設定する
            </Link>
          )}
        </Notice>
      )}
      {weight && diffDays(weight.date, view.base) > 14 && (
        <Notice tone="warn">
          最新の体重は {ymdJa(weight.date)} の記録です（基準日の{diffDays(weight.date, view.base)}日前）。計算はこの体重で行っています。
        </Notice>
      )}
      {p.missing.length > 0 && weight && goal && (
        <Notice tone="warn">
          基礎代謝の計算に {p.missing.join('・')} が必要です（計算式：{BMR_METHODS[settings.bmrMethod].label}）
        </Notice>
      )}
      {p.warnings.map((w) => (
        <Notice key={w} tone="danger">
          {w}
        </Notice>
      ))}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1.5">
          <p className="mb-2 text-xs font-black text-ink-3">からだ</p>
          <DataRow label="身長" value={num(view.heightCm)} unit="cm" />
          <DataRow
            label="現体重"
            value={num(weight?.value)}
            unit="kg"
            sub={toTarget != null ? (toTarget > 0 ? `目標まで ${signed(toTarget)}kg` : '目標達成') : weight ? `${md(weight.date)}時点` : undefined}
            subTone={toTarget != null ? (toTarget > 0 ? 'danger' : 'ok') : undefined}
          />
          <DataRow label="目標体重" value={num(goal?.targetWeightKg)} unit="kg" sub={goal ? `${md(goal.startDate)}に設定` : undefined} />
          <DataRow label="体脂肪率" value={num(bodyFat?.value)} unit="%" sub={bodyFat && weight && bodyFat.date !== weight.date ? `${md(bodyFat.date)}時点` : undefined} />
          <DataRow label="BMI" value={num(comp.bmi)} />
          <DataRow label="体脂肪量" value={num(comp.fatMassKg)} unit="kg" />
          <DataRow label="除脂肪体重" value={num(comp.leanMassKg)} unit="kg" />
          <DataRow label="活動係数" value={goal ? num(goal.activityFactor) : '—'} sub={goal ? activityLabel(settings, goal.activityFactor) : undefined} />
        </div>

        <div className="space-y-1.5">
          <p className="mb-2 text-xs font-black text-ink-3">1日の目安</p>
          <DataRow label="基礎代謝" value={int(p.bmr)} unit="kcal" sub={BMR_METHODS[settings.bmrMethod].label} />
          <DataRow label="消費カロリー" value={int(p.tdee)} unit="kcal" sub="基礎代謝 × 活動係数" />
          <DataRow label="削減カロリー" value={int(p.dailyDeficit)} unit="kcal" sub={pace ? `${pace.name}（−${pace.percentPerMonth}%／月）` : undefined} />
          <DataRow label="目標カロリー" value={int(goal ? p.targetKcal : null)} unit="kcal" emphasis />
          <DataRow label="たんぱく質" value={num(p.proteinG)} unit="g" sub={p.meatG != null ? `肉・魚なら約${int(p.meatG)}g` : undefined} />
          <DataRow label="脂質" value={num(goal ? p.fatG : null)} unit="g" />
          <DataRow label="炭水化物" value={num(goal ? p.carbsG : null)} unit="g" sub={goal && p.riceG != null ? `ご飯なら約${int(p.riceG)}g` : undefined} />
          <DataRow label="水分" value={int(p.waterMl)} unit="ml" />
        </div>

        <div className="rounded-xl border border-line p-4 md:col-span-2 md:flex md:flex-wrap md:items-center md:gap-8 xl:col-span-1 xl:block xl:w-72">
          <p className="text-xs font-black text-ink-3">目標のPFCバランス</p>
          <div className="mt-3">
            {goal && p.targetKcal != null && p.proteinG != null && p.fatG != null && p.carbsG != null ? (
              <PfcDonut grams={{ carbs: p.carbsG, fat: p.fatG, protein: p.proteinG }} targetKcal={p.targetKcal} />
            ) : (
              <p className="py-6 text-center text-sm text-ink-3">目標と体脂肪率がそろうと表示されます</p>
            )}
          </div>
          <dl className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-ink-2">
            <div className="flex justify-between">
              <dt>理想体重（BMI22）</dt>
              <dd className="num font-semibold">{num(comp.idealWeight22)}kg</dd>
            </div>
            <div className="flex justify-between">
              <dt>理想体重（BMI20）</dt>
              <dd className="num font-semibold">{num(comp.idealWeight20)}kg</dd>
            </div>
            {p.target && (
              <div className="flex justify-between">
                <dt>目標時の体脂肪率</dt>
                <dd className="num font-semibold">{num(p.target.bodyFatPct)}%</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  )
}

export function GoalProgress({ view, clientId }: { view: BodyView; clientId: string }) {
  const pr = view.progress
  const goal = view.goal
  if (!goal || !pr) {
    return <EmptyState title="目標が設定されていません" action={{ href: `/clients/${clientId}/body?date=${view.base}`, label: '目標を設定する' }} />
  }
  const plannedPct = pr.totalKg > 0 ? Math.min(100, Math.max(0, ((pr.startWeightKg - pr.plannedWeightKg) / pr.totalKg) * 100)) : null
  const reached = pr.remainingKg <= 0
  const goalDate = view.plan.daysToGoal != null ? addDays(view.base, Math.ceil(view.plan.daysToGoal)) : null

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_17rem] lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Figure label={`開始（${md(pr.startDate)}）`} value={num(pr.startWeightKg)} />
          <Figure label={`現在（${view.weight ? md(view.weight.date) : '—'}）`} value={num(pr.currentWeightKg)} strong />
          <Figure label="目標" value={num(pr.targetWeightKg)} />
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold text-ink-2">
              開始から <span className="num text-base text-ink">{signed(-pr.achievedKg)}kg</span>
            </span>
            {pr.progressPct != null && (
              <span className="font-bold text-ink-2">
                達成率 <span className="num text-base text-ink">{Math.round(pr.progressPct)}%</span>
              </span>
            )}
          </div>
          <div className="relative mt-2 h-3 rounded-full bg-brand-soft ring-1 ring-inset ring-brand-deep/40" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pr.progressPct ?? 0)} aria-label="目標の達成率">
            <div className="h-3 rounded-full bg-gold" style={{ width: `${pr.progressPct ?? 0}%` }} />
            {plannedPct != null && !reached && (
              <div className="absolute -top-1 h-5 w-0.5 bg-ink-2" style={{ left: `calc(${plannedPct}% - 1px)` }} aria-hidden>
                <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-ink-2">予定</span>
              </div>
            )}
          </div>
          <p className="mt-6 text-xs text-ink-3">
            {md(pr.startDate)}の設定：{view.pace?.name}（−{view.pace?.percentPerMonth}%／月）。縦線は今日時点で予定どおりなら到達している位置です。
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {reached ? (
          <div className="rounded-xl bg-ok-soft p-4">
            <Badge tone="ok">目標達成</Badge>
            <p className="mt-2 text-sm text-ok">目標体重に到達しています。次の目標を設定しましょう。</p>
          </div>
        ) : (
          <>
            <div className={cn('rounded-xl p-4', pr.aheadKg >= 0 ? 'bg-ok-soft' : 'bg-warn-soft')}>
              <p className="text-xs font-bold text-ink-2">予定ペースとの差</p>
              <p className={cn('mt-1 text-lg font-black', pr.aheadKg >= 0 ? 'text-ok' : 'text-warn')}>
                予定より{' '}
                <span className="num">{num(Math.abs(pr.aheadKg))}kg</span>
                {pr.aheadKg >= 0 ? ' 先行' : ' 遅れ'}
              </p>
              <p className="mt-0.5 text-xs text-ink-3">予定では今日 {num(pr.plannedWeightKg)}kg（開始から{pr.elapsedDays}日目）</p>
            </div>
            <div className="rounded-xl bg-soft p-4">
              <p className="text-xs font-bold text-ink-2">目標達成予定日（今の体重から）</p>
              <p className="mt-1 text-lg font-black text-ink">{goalDate ? ymdJa(goalDate) : '—'}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {goalDate ? `あと${diffDays(view.base, goalDate)}日・残り${num(pr.remainingKg)}kg` : ''}
                {pr.plannedGoalDate ? `（開始時の予定：${md(pr.plannedGoalDate)}）` : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl px-2 py-3', strong ? 'bg-dark text-white' : 'bg-soft')}>
      <p className={cn('text-xs font-bold', strong ? 'text-white/80' : 'text-ink-3')}>{label}</p>
      <p className="mt-1 text-2xl">
        <span className="num font-semibold">{value}</span>
        {value !== '—' && <span className={cn('ml-0.5 text-sm font-bold', strong ? 'text-white/70' : 'text-ink-3')}>kg</span>}
      </p>
    </div>
  )
}

export function ProjectionSummary({ view }: { view: BodyView }) {
  const p = view.plan
  const goalDate = p.daysToGoal != null ? addDays(view.base, Math.ceil(p.daysToGoal)) : null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryTile label="目標達成日" value={goalDate ? ymdJa(goalDate) : '—'} sub={p.daysToGoal != null ? `あと${Math.ceil(p.daysToGoal)}日` : undefined} />
      <SummaryTile label="1日の削減カロリー" value={p.dailyDeficit != null ? `${int(p.dailyDeficit)} kcal` : '—'} sub={view.pace ? `${view.pace.name}：現体重の−${view.pace.percentPerMonth}%／月` : undefined} />
      <SummaryTile label="減らす体重・カロリー" value={p.lossKg != null ? `${num(Math.max(0, p.lossKg))} kg` : '—'} sub={p.totalDeficitKcal != null ? `合計 ${int(p.totalDeficitKcal)}kcal（体脂肪1kg＝${int(view.settings.kcalPerKgFat)}kcal）` : undefined} />
    </div>
  )
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-soft px-4 py-3">
      <p className="text-xs font-bold text-ink-2">{label}</p>
      <p className="num mt-1 text-xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  )
}

export function ChangeGoalLink({ clientId, base }: { clientId: string; base: string }) {
  return (
    <Link href={`/clients/${clientId}/body?date=${base}#goal`} className="rounded-full bg-brand px-3 py-1 text-xs font-black text-ink hover:bg-brand-deep">
      目標・ペースを変更
    </Link>
  )
}

