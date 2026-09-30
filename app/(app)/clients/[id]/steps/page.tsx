import { WeightTrend } from '@/components/charts/WeightTrend'
import { AnsPanel } from '@/components/client/AnsPanel'
import { PhaseEditor } from '@/components/client/PhaseEditor'
import { ThemesForm } from '@/components/client/ThemesForm'
import { Section } from '@/components/ui'
import { resolveBaseDate } from '@/lib/base-date'
import { getAnsMeasurements } from '@/lib/data/ans'
import { getClient } from '@/lib/data/clients'
import { getBodyView } from '@/lib/data/overview'
import { getPhases, getThemes } from '@/lib/data/steps'
import { fromDbDate, monthKey } from '@/lib/dates'
import { requireUser } from '@/lib/session'
import { phasesInMonth, themeMonths } from '@/lib/steps'
import { saveThemesAction, uploadAnsAction } from './actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `${(await getClient(id)).name}｜ステップ` }
}

/** 顧客ステップ：期（自律神経期・ピラティス期など）、体重の流れと期、月ごとのテーマ、自律神経の測定結果 */
export default async function StepsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireUser()
  const { id } = await params
  const base = resolveBaseDate((await searchParams).date)
  const [client, phases, themes, ans, view] = await Promise.all([getClient(id), getPhases(id), getThemes(id), getAnsMeasurements(id), getBodyView(id, base)])
  const joinedOn = client.joinedOn ? fromDbDate(client.joinedOn) : null
  const months = themeMonths(joinedOn, base)
  const phasesByMonth = Object.fromEntries(months.map((m) => [m, phasesInMonth(phases, m).map((p) => ({ name: p.name, color: p.color }))]))

  return (
    <div className="space-y-5">
      <Section title="期（ステップ）" en="Steps">
        <p className="mb-3 text-sm text-ink-2">お客様がいまどの段階にいるかを入れます。いまの期はトレーニングの帯の「今月」に出て、体重のグラフには期ごとに色の帯がつきます。</p>
        <PhaseEditor clientId={id} phases={phases} base={base} joinedOn={joinedOn} />
      </Section>
      <Section title="体重・体脂肪率と期" en="Trend">
        <WeightTrend points={view.points} base={base} targetWeight={view.goal?.targetWeightKg ?? null} phases={phases} initialPeriod="all" />
      </Section>
      <Section title="月ごとのテーマ" en="Monthly Theme">
        <p className="mb-3 text-sm text-ink-2">その月に大事にすること（テーマ）と、トレーニングで意識すること（トレーニングテーマ）。今月の分はトレーニングの帯に出ます。</p>
        <ThemesForm key={base} action={saveThemesAction.bind(null, id)} months={months} themes={themes} phasesByMonth={phasesByMonth} current={monthKey(base)} />
      </Section>
      <Section title="自律神経の測定" en="ANS">
        <AnsPanel key={base} clientId={id} action={uploadAnsAction.bind(null, id)} base={base} rows={ans} />
      </Section>
    </div>
  )
}
