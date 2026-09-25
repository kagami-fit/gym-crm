'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { BasicData, ProjectionSummary } from '@/components/client/BodyBlocks'
import { ProjectionChart } from '@/components/charts/ProjectionChart'
import { Pills } from '@/components/ClientForm'
import { Card, Field, Section, buttonClass, inputClass, numInputClass } from '@/components/ui'
import { plan, projection, type Gender } from '@/lib/calc/body'
import { findPace, type CalcSettings } from '@/lib/calc/settings'
import { GENDERS } from '@/lib/labels'
import type { BodyView } from '@/lib/data/overview'

const n = (v: string) => {
  const x = Number(v)
  return v.trim() !== '' && Number.isFinite(x) ? x : null
}

/** 体験（入会前）のお客様向け：その場で入力して目標カロリーと達成見込みを見せる。保存はしない */
export function SimulatorForm({ settings, today }: { settings: CalcSettings; today: string }) {
  const [v, setV] = useState({ age: '', gender: '', height: '', weight: '', bodyFat: '', activity: String(settings.activityFactors[0]?.value ?? ''), target: '', pace: settings.paces[0]?.key ?? '' })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  const view: BodyView | null = useMemo(() => {
    const weight = n(v.weight)
    if (weight == null) return null
    const pace = findPace(settings, v.pace)
    const body = { weightKg: weight, bodyFatPct: n(v.bodyFat), heightCm: n(v.height), age: n(v.age), gender: (v.gender || null) as Gender | null }
    const target = n(v.target)
    const p = plan(settings, body, { targetWeightKg: target, pace, activityFactor: n(v.activity) })
    const goal =
      target != null && pace
        ? { id: 'sim', startDate: today, startWeightKg: weight, startBodyFatPct: body.bodyFatPct, targetWeightKg: target, paceKey: pace.key, activityFactor: n(v.activity) ?? 1.2, note: null, createdAt: new Date(0) }
        : null
    const args = goal && p.dailyDeficit != null ? { baseDate: today, weightKg: weight, fatMassKg: p.composition.fatMassKg, targetWeightKg: goal.targetWeightKg, dailyDeficit: p.dailyDeficit } : null
    return {
      settings,
      base: today,
      age: body.age,
      heightCm: body.heightCm,
      gender: body.gender,
      weight: { value: weight, date: today },
      bodyFat: body.bodyFatPct != null ? { value: body.bodyFatPct, date: today } : null,
      goal,
      goals: goal ? [goal] : [],
      pace,
      plan: p,
      progress: null,
      months: args ? projection(settings, args, 'month', 6) : [],
      weeks: args ? projection(settings, args, 'week', 10) : [],
      points: [],
    }
  }, [v, settings, today])

  const registerHref = `/clients/new?${new URLSearchParams({
    status: 'trial',
    ...(v.gender ? { gender: v.gender } : {}),
    ...(v.height ? { h: v.height } : {}),
    ...(v.weight ? { w: v.weight } : {}),
    ...(v.bodyFat ? { bf: v.bodyFat } : {}),
    ...(v.target ? { t: v.target } : {}),
    ...(v.pace ? { pace: v.pace } : {}),
    ...(v.activity ? { act: v.activity } : {}),
  })}`

  return (
    <div className="space-y-5">
      <Card title="お客様の情報" description="入力するとすぐ下に計算結果が出ます。この画面の内容は保存されません">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="年齢">
            <input value={v.age} onChange={set('age')} inputMode="numeric" className={numInputClass} placeholder="35" />
          </Field>
          <div className="sm:col-span-1 lg:col-span-3">
            <p className="text-sm font-bold">性別</p>
            <div className="mt-1.5" onChange={(e) => setV((x) => ({ ...x, gender: (e.target as HTMLInputElement).value }))}>
              <Pills name="gender" options={Object.entries(GENDERS).map(([value, label]) => ({ value, label }))} defaultValue={v.gender} />
            </div>
          </div>
          <Field label="身長（cm）">
            <input value={v.height} onChange={set('height')} inputMode="decimal" className={numInputClass} placeholder="165.0" />
          </Field>
          <Field label="体重（kg）">
            <input value={v.weight} onChange={set('weight')} inputMode="decimal" className={numInputClass} placeholder="65.0" />
          </Field>
          <Field label="体脂肪率（%）">
            <input value={v.bodyFat} onChange={set('bodyFat')} inputMode="decimal" className={numInputClass} placeholder="25.0" />
          </Field>
          <Field label="活動係数">
            <select value={v.activity} onChange={set('activity')} className={inputClass}>
              {settings.activityFactors.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.value}（{a.label}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="目標体重（kg）">
            <input value={v.target} onChange={set('target')} inputMode="decimal" className={numInputClass} placeholder="60.0" />
          </Field>
          <Field label="減量ペース">
            <select value={v.pace} onChange={set('pace')} className={inputClass}>
              {settings.paces.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}（現体重の−{p.percentPerMonth}%／月{p.note ? `・${p.note}` : ''}）
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {view ? (
        <>
          <Section title="計算結果" en="Result">
            <BasicData view={view} clientId={null} />
          </Section>
          {view.goal && view.months.length > 0 && (
            <Section title="体重・体脂肪率の予測" en="Forecast">
              <div className="space-y-4">
                <ProjectionSummary view={view} />
                <ProjectionChart
                  base={today}
                  current={{ weightKg: view.weight!.value, bodyFatPct: view.bodyFat?.value ?? null, fatMassKg: view.plan.composition.fatMassKg }}
                  targetWeight={view.goal.targetWeightKg}
                  month={view.months}
                  week={view.weeks}
                />
              </div>
            </Section>
          )}
          <div className="flex justify-end">
            <Link href={registerHref} className={buttonClass.primary}>
              <UserPlus className="size-4" aria-hidden />
              この内容で顧客登録する
            </Link>
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-2 bg-white py-10 text-center text-sm text-ink-3">体重を入れると、目標カロリーと達成見込みが表示されます</p>
      )}
    </div>
  )
}
