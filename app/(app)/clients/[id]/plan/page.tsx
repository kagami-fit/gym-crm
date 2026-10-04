import { WeightTrend } from '@/components/charts/WeightTrend'
import { AnsPanel } from '@/components/client/AnsPanel'
import { PhaseEditor } from '@/components/client/PhaseEditor'
import { ThemesForm } from '@/components/client/ThemesForm'
import { ConditionPanel } from '@/components/plan/ConditionPanel'
import { MovementPanel } from '@/components/plan/MovementPanel'
import { Phase2Check } from '@/components/plan/Phase2Check'
import { PlanSummary } from '@/components/plan/PlanSummary'
import { PolicyEditor } from '@/components/plan/PolicyEditor'
import { Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getClient } from '@/lib/data/clients'
import { getBodyView } from '@/lib/data/overview'
import { getPlanView, latestMovements } from '@/lib/data/plan'
import { getThemes } from '@/lib/data/steps'
import { fromDbDate, monthKey } from '@/lib/dates'
import { PHASE_PRESETS, policyLabel } from '@/lib/labels'
import { requireUser } from '@/lib/session'
import { phasesInMonth, themeMonths } from '@/lib/steps'
import { saveThemesAction, uploadAnsAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜指導計画` }
}

const anchor = 'scroll-mt-[calc(var(--client-tabs-h)+12px)]'
const NAV = [
  { id: 'phase', label: 'フェーズ' },
  { id: 'policy', label: '食事方針' },
  { id: 'ans', label: '自律神経' },
  { id: 'movement', label: '動作' },
  { id: 'condition', label: '体調' },
  { id: 'trend', label: '体重とフェーズ' },
  { id: 'theme', label: '月のテーマ' },
]

/**
 * 指導計画：現在地、フェーズ（とフェーズ2への移行チェック）、食事方針、自律神経の評価、動作の評価、体調チェック、月ごとのテーマ。
 * 2026-10-04 の整理：自律神経への対応とピラティスはフェーズ1で並行して進め、フェーズ2で目的（コーフラックス・減量・維持）に合わせて進める。
 */
export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const [client, view, themes, body] = await Promise.all([getClient(id), getPlanView(id, base), getThemes(id), getBodyView(id, base)])
  const joinedOn = client.joinedOn ? fromDbDate(client.joinedOn) : null
  const months = themeMonths(joinedOn, base)
  const phasesByMonth = Object.fromEntries(months.map((m) => [m, phasesInMonth(view.phases, m).map((p) => ({ name: p.name, color: p.color }))]))
  const inPhase1 = view.phase?.name === PHASE_PRESETS[0].name
  const policies = [...view.goals].reverse().map((g) => ({ start: g.startDate, label: policyLabel(g.policy, g.policyName) }))

  return (
    <div className="space-y-5">
      <Section title="現在地" en="Now">
        <PlanSummary view={view} />
        <nav className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3" aria-label="指導計画の中の移動">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} className="inline-flex h-9 items-center rounded-full bg-soft px-3.5 text-sm font-bold text-ink-2 ring-1 ring-line hover:bg-brand-soft">
              {n.label}
            </a>
          ))}
        </nav>
      </Section>

      <Section title="フェーズ" en="Phase" id="phase" className={anchor}>
        <p className="mb-3 text-sm text-ink-2">フェーズ1（体を整える）では、自律神経への対応とピラティスを並行して進めます。フェーズ2（目的に合わせて進める）では筋トレと食事方針で進めます。変えるときは理由を残します。期間が過ぎたことだけでは変えません。</p>
        <PhaseEditor clientId={id} phases={view.phases} base={base} joinedOn={joinedOn} />
        {inPhase1 && (
          <div className="mt-5">
            <Phase2Check clientId={id} base={base} ans={view.ans} conditions={view.conditions} movements={latestMovements(view.movements, base)} visitFrequency={view.phase?.visitFrequency ?? null} />
          </div>
        )}
      </Section>

      <Section title="食事方針" en="Diet Policy" id="policy" className={anchor}>
        <PolicyEditor clientId={id} base={base} goals={view.goals} current={view.policy} paces={body.settings.paces} activityFactors={body.settings.activityFactors} phaseName={view.phase?.name ?? null} />
      </Section>

      <Section title="自律神経の評価" en="ANS" id="ans" className={anchor}>
        <AnsPanel key={base} clientId={id} action={uploadAnsAction.bind(null, id)} base={base} rows={view.ans} />
      </Section>

      <Section title="動作の評価（ピラティス）" en="Movement" id="movement" className={anchor}>
        <p className="mb-3 text-sm text-ink-2">6つの動きを「未評価・練習中・達成」で記録します。評価のたびに残るので、前の段階に戻ったことも分かります。全部達成しないと移行できない、という決まりはまだありません。</p>
        <MovementPanel clientId={id} base={base} rows={view.movements} />
      </Section>

      <Section title="体調チェック（本人の訴え）" en="Condition" id="condition" className={anchor}>
        <ConditionPanel clientId={id} base={base} rows={view.conditions} />
      </Section>

      <Section title="体重とフェーズ" en="Trend" id="trend" className={anchor}>
        <WeightTrend points={body.points} base={base} targetWeight={body.goal?.policy === 'loss' ? (body.goal.targetWeightKg ?? null) : null} phases={view.phases} policies={policies} initialPeriod="all" />
      </Section>

      <Section title="月ごとのテーマ" en="Monthly Theme" id="theme" className={anchor}>
        <p className="mb-3 text-sm text-ink-2">その月に大事にすること（テーマ）と、トレーニングで意識すること（トレーニングテーマ）。今月の分はトレーニングの帯に出ます。</p>
        <ThemesForm key={base} action={saveThemesAction.bind(null, id)} months={months} themes={themes} phasesByMonth={phasesByMonth} current={monthKey(base)} />
      </Section>
    </div>
  )
}
