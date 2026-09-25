'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, ChartLegend, DataTable, SegmentedControl, TooltipBox } from './ChartParts'
import { C, activeDotStyle, axisTick, dotStyle, niceScale } from './theme'
import { md, ymdJa } from '@/lib/dates'
import { int, num } from '@/lib/format'
import type { ProjectionRow } from '@/lib/calc/body'

type Row = { label: string; date: string; weight: number; bodyFat: number | null }

export function ProjectionChart({
  base,
  current,
  targetWeight,
  month,
  week,
}: {
  base: string
  current: { weightKg: number; bodyFatPct: number | null; fatMassKg: number | null }
  targetWeight: number
  month: ProjectionRow[]
  week: ProjectionRow[]
}) {
  const [unit, setUnit] = useState<'month' | 'week'>('month')
  const src = unit === 'month' ? month : week
  const rows: Row[] = [
    { label: '基準日', date: base, weight: current.weightKg, bodyFat: current.bodyFatPct },
    ...src.map((r) => ({ label: r.label.replace('ヶ月後', 'ヶ月').replace('週間後', '週'), date: r.date, weight: r.weightKg, bodyFat: r.bodyFatPct })),
  ]
  const unitLabel = unit === 'month' ? '月単位（1〜6ヶ月後）' : '週単位（1〜10週後）'

  const table = (
    <DataTable
      head={['期間', '日付', '削減カロリー', '削減体重', '体重', '体脂肪率', '体脂肪量']}
      rows={[
        ['基準日', md(base), '—', '—', `${num(current.weightKg)}kg`, current.bodyFatPct != null ? `${num(current.bodyFatPct)}%` : '—', current.fatMassKg != null ? `${num(current.fatMassKg)}kg` : '—'],
        ...src.map((r) => [
          r.label,
          md(r.date),
          `${int(r.periodDeficitKcal)}kcal`,
          `${num(r.periodLossKg, 2)}kg`,
          `${num(r.weightKg)}kg`,
          r.bodyFatPct != null ? `${num(r.bodyFatPct)}%` : '—',
          r.fatMassKg != null ? `${num(r.fatMassKg)}kg` : '—',
        ]),
      ]}
    />
  )
  const margin = { top: 8, right: 16, bottom: 0, left: 0 }
  const tip = (_: unknown, row: unknown) => {
    const r = row as Row
    return `${r.label === '基準日' ? '基準日' : r.label.replace('ヶ月', 'ヶ月後').replace('週', '週間後')}（${ymdJa(r.date)}）`
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="予測の単位"
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'month', label: '月単位' },
            { value: 'week', label: '週単位' },
          ]}
        />
        <ChartLegend
          items={[
            { label: '予測', color: C.weight, kind: 'dash' },
            { label: '目標体重', color: C.target, kind: 'line' },
          ]}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <ChartCard title={`体重の推移予測（${unitLabel}）`} className="lg:col-span-3" table={table}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rows} margin={margin}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={8} />
              <YAxis {...niceScale([...rows.map((r) => r.weight), targetWeight])} tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => num(v)} />
              <Tooltip cursor={{ stroke: C.axis, strokeWidth: 1 }} content={(p) => <TooltipBox {...p} title={tip} format={(v) => `${num(v)}kg`} />} />
              <ReferenceLine y={targetWeight} stroke={C.target} strokeWidth={1} label={{ value: `目標 ${num(targetWeight)}kg`, position: 'insideBottomRight', fill: C.target, fontSize: 11 }} />
              <Line type="linear" dataKey="weight" name="体重" stroke={C.weight} strokeWidth={2} strokeDasharray="6 4" dot={dotStyle(C.weight)} activeDot={activeDotStyle(C.weight)} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="体脂肪率の推移予測" subtitle="減った分をすべて体脂肪とした場合" className="lg:col-span-2" table={table}>
          {rows.some((r) => r.bodyFat != null) ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={rows} margin={margin}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={8} />
                <YAxis {...niceScale(rows.map((r) => r.bodyFat))} tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => num(v)} />
                <Tooltip cursor={{ stroke: C.axis, strokeWidth: 1 }} content={(p) => <TooltipBox {...p} title={tip} format={(v) => `${num(v)}%`} />} />
                <Line type="linear" dataKey="bodyFat" name="体脂肪率" stroke={C.bodyFat} strokeWidth={2} strokeDasharray="6 4" dot={dotStyle(C.bodyFat)} activeDot={activeDotStyle(C.bodyFat)} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-ink-3">体脂肪率を記録すると予測が出ます</p>
          )}
        </ChartCard>
      </div>
    </div>
  )
}
