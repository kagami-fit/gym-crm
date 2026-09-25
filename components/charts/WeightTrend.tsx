'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, DataTable, SegmentedControl, TooltipBox } from './ChartParts'
import { C, activeDotStyle, axisTick, dotStyle, niceScale } from './theme'
import { addMonthsKey, daysEndingAt, md, mdw, monthKey, monthShort, monthJa } from '@/lib/dates'
import { num, signed } from '@/lib/format'

type Point = { date: string; weightKg: number | null; bodyFatPct: number | null }
type Period = '1w' | '1m' | '6m'
type Row = { key: string; label: string; tip: string; weight: number | null; bodyFat: number | null }

const avg = (v: Array<number | null>) => {
  const x = v.filter((n): n is number => n != null)
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : null
}

function build(points: Point[], base: string, period: Period): { rows: Row[]; prev: Row[] } {
  const map = new Map(points.map((p) => [p.date, p]))
  if (period === '6m') {
    const last = monthKey(base)
    const keys = Array.from({ length: 6 }, (_, i) => addMonthsKey(last, i - 5))
    const rows = keys.map((k) => {
      const inMonth = points.filter((p) => monthKey(p.date) === k && p.date <= base)
      return { key: k, label: monthShort(k), tip: `${monthJa(k)}の平均`, weight: avg(inMonth.map((p) => p.weightKg)), bodyFat: avg(inMonth.map((p) => p.bodyFatPct)) }
    })
    return { rows, prev: [] }
  }
  const n = period === '1w' ? 7 : 30
  const days = daysEndingAt(base, n * 2)
  const toRow = (d: string): Row => ({ key: d, label: period === '1w' ? mdw(d) : md(d), tip: mdw(d), weight: map.get(d)?.weightKg ?? null, bodyFat: map.get(d)?.bodyFatPct ?? null })
  return { rows: days.slice(n).map(toRow), prev: days.slice(0, n).map(toRow) }
}

export function WeightTrend({ points, base, targetWeight }: { points: Point[]; base: string; targetWeight: number | null }) {
  const [period, setPeriod] = useState<Period>('1m')
  const { rows, prev } = useMemo(() => build(points, base, period), [points, base, period])
  const hasFat = rows.some((r) => r.bodyFat != null)
  const hasWeight = rows.some((r) => r.weight != null)
  const showDots = period !== '1m'

  const wAvg = avg(rows.map((r) => r.weight))
  const wPrevAvg = avg(prev.map((r) => r.weight))
  const fAvg = avg(rows.map((r) => r.bodyFat))
  const fPrevAvg = avg(prev.map((r) => r.bodyFat))
  const firstLast = (key: 'weight' | 'bodyFat') => {
    const v = rows.map((r) => r[key]).filter((x): x is number => x != null)
    return v.length >= 2 ? v[v.length - 1] - v[0] : null
  }
  const weights = rows.map((r) => r.weight).filter((x): x is number => x != null)
  const minWeight = weights.length ? Math.min(...weights) : null
  const periodLabel = period === '1w' ? '直近1週間' : period === '1m' ? '直近1ヶ月' : '直近6ヶ月（月平均）'
  const prevLabel = period === '1w' ? '前の週' : '前の1ヶ月'

  const table = (
    <DataTable
      head={[period === '6m' ? '月' : '日付', '体重(kg)', '体脂肪率(%)']}
      rows={[...rows].reverse().map((r) => [period === '6m' ? monthJa(r.key) : mdw(r.key), num(r.weight), num(r.bodyFat)])}
    />
  )

  const chartMargin = { top: 8, right: 12, bottom: 0, left: 0 }
  const xAxis = <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={14} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="期間"
          value={period}
          onChange={setPeriod}
          options={[
            { value: '1w', label: '直近1週間' },
            { value: '1m', label: '直近1ヶ月' },
            { value: '6m', label: '6ヶ月（月平均）' },
          ]}
        />
        <p className="text-xs text-ink-3">体重と体脂肪率は目盛りが違うため、別々のグラフで表示しています</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`${periodLabel}の平均体重`} value={num(wAvg)} unit="kg" sub={period !== '6m' && wAvg != null && wPrevAvg != null ? `${prevLabel}比 ${signed(wAvg - wPrevAvg)}kg` : period === '6m' && firstLast('weight') != null ? `6ヶ月で ${signed(firstLast('weight'))}kg` : undefined} />
        <Stat label={`${periodLabel}の平均体脂肪率`} value={num(fAvg)} unit="%" sub={period !== '6m' && fAvg != null && fPrevAvg != null ? `${prevLabel}比 ${signed(fAvg - fPrevAvg)}pt` : period === '6m' && firstLast('bodyFat') != null ? `6ヶ月で ${signed(firstLast('bodyFat'))}pt` : undefined} />
        <Stat label="期間中の最低体重" value={num(minWeight)} unit="kg" />
        <Stat label="目標体重" value={num(targetWeight)} unit="kg" sub={targetWeight != null && wAvg != null ? `平均からあと ${num(Math.max(0, wAvg - targetWeight))}kg` : undefined} />
      </div>

      <ChartCard title={`体重（${periodLabel}）`} subtitle={targetWeight != null ? '線は目標体重' : undefined} table={table}>
        {hasWeight ? (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={rows} margin={chartMargin}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              {xAxis}
              <YAxis {...niceScale([...rows.map((r) => r.weight), targetWeight])} tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => num(v)} />
              <Tooltip cursor={{ stroke: C.axis, strokeWidth: 1 }} content={(p) => <TooltipBox {...p} title={(_, row) => (row as Row).tip} format={(v) => `${num(v)}kg`} />} />
              {targetWeight != null && (
                <ReferenceLine y={targetWeight} stroke={C.target} strokeDasharray="4 4" strokeWidth={1} label={{ value: `目標 ${num(targetWeight)}kg`, position: 'insideTopRight', fill: C.target, fontSize: 11 }} />
              )}
              <Line type="monotone" dataKey="weight" name="体重" stroke={C.weight} strokeWidth={2} dot={showDots ? dotStyle(C.weight) : false} activeDot={activeDotStyle(C.weight)} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-ink-3">この期間の体重の記録はありません</p>
        )}
      </ChartCard>

      <ChartCard title={`体脂肪率（${periodLabel}）`} table={table}>
        {hasFat ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={rows} margin={chartMargin}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              {xAxis}
              <YAxis {...niceScale(rows.map((r) => r.bodyFat))} tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => num(v)} />
              <Tooltip cursor={{ stroke: C.axis, strokeWidth: 1 }} content={(p) => <TooltipBox {...p} title={(_, row) => (row as Row).tip} format={(v) => `${num(v)}%`} />} />
              <Line type="monotone" dataKey="bodyFat" name="体脂肪率" stroke={C.bodyFat} strokeWidth={2} dot={showDots ? dotStyle(C.bodyFat) : false} activeDot={activeDotStyle(C.bodyFat)} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-ink-3">この期間の体脂肪率の記録はありません</p>
        )}
      </ChartCard>
    </div>
  )
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-soft px-4 py-3">
      <p className="text-xs font-bold text-ink-2">{label}</p>
      <p className="mt-1 text-2xl text-ink">
        <span className="num font-semibold">{value}</span>
        {value !== '—' && <span className="ml-0.5 text-sm font-bold text-ink-3">{unit}</span>}
      </p>
      <p className="mt-0.5 min-h-4 text-xs text-ink-3">{sub ?? ''}</p>
    </div>
  )
}
