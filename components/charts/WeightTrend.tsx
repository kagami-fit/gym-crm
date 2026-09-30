'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, DataTable, SegmentedControl, TooltipBox } from './ChartParts'
import { C, activeDotStyle, axisTick, dotStyle, niceScale } from './theme'
import { addDays, addMonthsKey, daysEndingAt, diffDays, md, mdw, monthKey, monthShort, monthJa, weekStartOf } from '@/lib/dates'
import { num, signed } from '@/lib/format'

type Point = { date: string; weightKg: number | null; bodyFatPct: number | null }
type Period = '1w' | '1m' | '6m' | 'all'
/** 期（自律神経期など）。until が null なら基準日まで続いている */
export type ChartPhase = { name: string; start: string; until: string | null; color: string }
/** from・to：その行が表す期間（日・週・月） */
type Row = { key: string; label: string; tip: string; weight: number | null; bodyFat: number | null; from: string; to: string; phase?: string }

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
      return { key: k, label: monthShort(k), tip: `${monthJa(k)}の平均`, weight: avg(inMonth.map((p) => p.weightKg)), bodyFat: avg(inMonth.map((p) => p.bodyFatPct)), from: `${k}-01`, to: addDays(`${addMonthsKey(k, 1)}-01`, -1) }
    })
    return { rows, prev: [] }
  }
  if (period === 'all') {
    // 記録の最初の週から基準日の週まで、週ごとの平均（最大52週）
    const withData = points.filter((p) => p.date <= base && (p.weightKg != null || p.bodyFatPct != null))
    if (!withData.length) return { rows: [], prev: [] }
    const lastWeek = weekStartOf(base)
    let first = weekStartOf(withData[0].date)
    if (diffDays(first, lastWeek) > 7 * 51) first = addDays(lastWeek, -7 * 51)
    const rows: Row[] = []
    for (let w = first; w <= lastWeek; w = addDays(w, 7)) {
      const inWeek = points.filter((p) => p.date >= w && p.date <= addDays(w, 6) && p.date <= base)
      rows.push({ key: w, label: md(w), tip: `${md(w)}〜${md(addDays(w, 6))}の平均`, weight: avg(inWeek.map((p) => p.weightKg)), bodyFat: avg(inWeek.map((p) => p.bodyFatPct)), from: w, to: addDays(w, 6) })
    }
    return { rows, prev: [] }
  }
  const n = period === '1w' ? 7 : 30
  const days = daysEndingAt(base, n * 2)
  const toRow = (d: string): Row => ({ key: d, label: period === '1w' ? mdw(d) : md(d), tip: mdw(d), weight: map.get(d)?.weightKg ?? null, bodyFat: map.get(d)?.bodyFatPct ?? null, from: d, to: d })
  return { rows: days.slice(n).map(toRow), prev: days.slice(0, n).map(toRow) }
}

/** 期ごとに、グラフのどの行からどの行までを塗るか（行の期間と期が重なるところ） */
function phaseBands(rows: Row[], phases: ChartPhase[], base: string) {
  const bands = phases
    .map((p) => {
      const until = p.until ?? base
      const idx = rows.flatMap((r, i) => (r.from <= until && r.to >= p.start ? [i] : []))
      return idx.length ? { ...p, i1: idx[0], i2: idx[idx.length - 1] } : null
    })
    .filter((b): b is ChartPhase & { i1: number; i2: number } => b != null)
  // 次の期がすぐ続くときは、帯のあいだにすき間ができないよう、次の期の最初の点までのばす
  return bands.map((b, k) => {
    const next = bands[k + 1]
    const i2 = next && next.i1 === b.i2 + 1 ? next.i1 : b.i2
    return { ...b, x1: rows[b.i1].label, x2: rows[i2].label }
  })
}

export function WeightTrend({ points, base, targetWeight, phases = [], initialPeriod = '1m' }: { points: Point[]; base: string; targetWeight: number | null; phases?: ChartPhase[]; initialPeriod?: Period }) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const { rows, prev } = useMemo(() => {
    const b = build(points, base, period)
    // 表で見るときにも期がわかるよう、行ごとに期の名前をつける（行の最後の日の期）
    for (const r of b.rows) r.phase = [...phases].reverse().find((p) => p.start <= r.to && (p.until ?? base) >= r.from)?.name
    return b
  }, [points, base, period, phases])
  const bands = useMemo(() => phaseBands(rows, phases, base), [rows, phases, base])
  const hasFat = rows.some((r) => r.bodyFat != null)
  const hasWeight = rows.some((r) => r.weight != null)
  const showDots = period === '1w' || period === '6m'

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
  const periodLabel = period === '1w' ? '直近1週間' : period === '1m' ? '直近1ヶ月' : period === '6m' ? '直近6ヶ月（月平均）' : '記録のはじめから（週平均）'
  const prevLabel = period === '1w' ? '前の週' : '前の1ヶ月'

  const table = (
    <DataTable
      head={[period === '6m' ? '月' : period === 'all' ? '週' : '日付', '体重(kg)', '体脂肪率(%)', ...(phases.length ? ['期'] : [])]}
      rows={[...rows].reverse().map((r) => [period === '6m' ? monthJa(r.key) : period === 'all' ? `${md(r.from)}〜${md(r.to)}` : mdw(r.key), num(r.weight), num(r.bodyFat), ...(phases.length ? [r.phase ?? '—'] : [])])}
    />
  )
  // 期の色の帯（線の後ろに薄く。帯の左上に期の名前も出す。文字は読みやすいようインクの色）
  const bandEls = bands.map((b) => (
    <ReferenceArea key={`${b.name}-${b.start}`} x1={b.x1} x2={b.x2} fill={b.color} fillOpacity={0.12} stroke="none" ifOverflow="hidden" label={{ value: b.name, position: 'insideTopLeft', fill: C.ink, fontSize: 11, fontWeight: 700 }} />
  ))
  const legend = bands.length > 0 && (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-1 text-xs text-ink-2">
      <span className="font-bold">期：</span>
      {[...new Map(bands.map((b) => [b.name, b.color])).entries()].map(([name, color]) => (
        <span key={name} className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-4 rounded-sm ring-1 ring-inset" style={{ background: `${color}40`, ['--tw-ring-color' as string]: color }} aria-hidden />
          {name}
        </span>
      ))}
    </p>
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
            { value: 'all', label: 'はじめから（週平均）' },
          ]}
        />
        <p className="text-xs text-ink-3">体重と体脂肪率は目盛りが違うため、別々のグラフで表示しています</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`${periodLabel}の平均体重`} value={num(wAvg)} unit="kg" sub={(period === '1w' || period === '1m') && wAvg != null && wPrevAvg != null ? `${prevLabel}比 ${signed(wAvg - wPrevAvg)}kg` : period !== '1w' && period !== '1m' && firstLast('weight') != null ? `${period === '6m' ? '6ヶ月' : 'はじめから'}で ${signed(firstLast('weight'))}kg` : undefined} />
        <Stat label={`${periodLabel}の平均体脂肪率`} value={num(fAvg)} unit="%" sub={(period === '1w' || period === '1m') && fAvg != null && fPrevAvg != null ? `${prevLabel}比 ${signed(fAvg - fPrevAvg)}pt` : period !== '1w' && period !== '1m' && firstLast('bodyFat') != null ? `${period === '6m' ? '6ヶ月' : 'はじめから'}で ${signed(firstLast('bodyFat'))}pt` : undefined} />
        <Stat label="期間中の最低体重" value={num(minWeight)} unit="kg" />
        <Stat label="目標体重" value={num(targetWeight)} unit="kg" sub={targetWeight != null && wAvg != null ? `平均からあと ${num(Math.max(0, wAvg - targetWeight))}kg` : undefined} />
      </div>

      <ChartCard title={`体重（${periodLabel}）`} subtitle={targetWeight != null ? '線は目標体重' : undefined} table={table}>
        {hasWeight ? (
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={rows} margin={chartMargin}>
              {bandEls}
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
        {hasWeight && legend}
      </ChartCard>

      <ChartCard title={`体脂肪率（${periodLabel}）`} table={table}>
        {hasFat ? (
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={rows} margin={chartMargin}>
              {bandEls}
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
