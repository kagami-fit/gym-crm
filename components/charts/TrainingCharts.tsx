'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, DataTable, SegmentedControl, TooltipBox } from './ChartParts'
import { C, axisTick } from './theme'
import { md, mdw, monthJa, monthShort } from '@/lib/dates'
import { int, num } from '@/lib/format'
import { metricSeries, monthlyAverages, recentVolumes, type SessionRows } from '@/lib/calc/training'
import type { OneRmMethod } from '@/lib/calc/settings'
import { inputClass } from '@/components/ui'
import { cn } from '@/lib/utils'

const barProps = { fill: C.bar, radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 24, isAnimationActive: false }
const kg = (v: number) => (v >= 1000 ? int(v) : num(v, v % 1 === 0 ? 0 : 1))

function SimpleBars({ data, dataKey, name, unit, height = 200, tip }: { data: Array<Record<string, unknown>>; dataKey: string; name: string; unit: string; height?: number; tip: (row: Record<string, unknown>) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: C.axis }} minTickGap={6} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => int(v)} />
        <Tooltip cursor={{ fill: 'rgba(201,133,0,0.08)' }} content={(p) => <TooltipBox {...p} title={(_, row) => tip(row as Record<string, unknown>)} format={(v) => `${kg(v)}${unit}`} />} />
        <Bar dataKey={dataKey} name={name} {...barProps} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** 総負荷量：直近の回と月間平均（1回あたり） */
export function VolumeCharts({ sessions, base, count }: { sessions: SessionRows[]; base: string; count: number }) {
  const recent = useMemo(() => recentVolumes(sessions, base, count).map((r) => ({ ...r, label: md(r.date) })), [sessions, base, count])
  const monthly = useMemo(() => {
    const all = monthlyAverages(sessions, base, 12)
    // 記録が始まる前の空の月は出さない（最低3ヶ月は表示）
    const first = all.findIndex((m) => m.sessions > 0)
    const from = first < 0 ? all.length - 3 : Math.min(first, all.length - 3)
    return all.slice(Math.max(0, from)).map((m) => ({ ...m, label: monthShort(m.month) }))
  }, [sessions, base])
  if (!recent.length) return <p className="rounded-xl bg-soft py-10 text-center text-sm text-ink-3">基準日までのトレーニング記録はありません</p>
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChartCard
        title={`総負荷量（直近${recent.length}回）`}
        subtitle="重さ×回数×セット数の合計（kg）"
        table={<DataTable head={['日付', '総負荷量(kg)']} rows={[...recent].reverse().map((r) => [mdw(r.date), int(r.volume)])} />}
      >
        <SimpleBars data={recent} dataKey="volume" name="総負荷量" unit="kg" tip={(r) => mdw(String(r.date))} />
      </ChartCard>
      <ChartCard
        title="総負荷量の月間平均（1回あたり）"
        subtitle="その月の総負荷量 ÷ 来店回数"
        table={<DataTable head={['月', '来店回数', '1回あたり(kg)']} rows={[...monthly].reverse().map((m) => [monthJa(m.month), `${m.sessions}回`, m.average != null ? int(m.average) : '—'])} />}
      >
        <SimpleBars data={monthly} dataKey="average" name="1回あたり" unit="kg" tip={(r) => `${monthJa(String(r.month))}（${r.sessions}回）`} />
      </ChartCard>
    </div>
  )
}

/** 部位別・種目別の4指標（セット数・総負荷量・最大重量・推定1RM） */
export function MetricCharts({ sessions, base, count, bodyParts, method }: { sessions: SessionRows[]; base: string; count: number; bodyParts: string[]; method: OneRmMethod }) {
  const upTo = useMemo(() => sessions.filter((s) => s.date <= base), [sessions, base])
  const partsWithData = useMemo(() => {
    const used = new Set(upTo.flatMap((s) => s.rows.map((r) => r.bodyPart)))
    return [...bodyParts.filter((p) => used.has(p)), ...[...used].filter((p) => !bodyParts.includes(p))]
  }, [upTo, bodyParts])
  const exercises = useMemo(() => {
    const m = new Map<string, { part: string; count: number; last: string }>()
    for (const s of upTo) for (const r of s.rows) {
      const e = m.get(r.exercise) ?? { part: r.bodyPart, count: 0, last: s.date }
      e.count += 1
      e.last = s.date > e.last ? s.date : e.last
      m.set(r.exercise, e)
    }
    return [...m.entries()].sort((a, b) => (a[1].last < b[1].last ? 1 : -1))
  }, [upTo])

  const [mode, setMode] = useState<'part' | 'exercise'>('part')
  const [part, setPart] = useState(partsWithData[0] ?? '')
  const [exercise, setExercise] = useState(exercises[0]?.[0] ?? '')
  const series = useMemo(
    () =>
      metricSeries(upTo, mode === 'part' ? { bodyPart: part } : { exercise }, base, count, method).map((p) => ({ ...p, label: md(p.date), max1RM: p.max1RM ?? 0 })),
    [upTo, mode, part, exercise, base, count, method],
  )

  if (!partsWithData.length) return null
  const subject = mode === 'part' ? `部位：${part}` : `種目：${exercise}`
  const table = (
    <DataTable
      head={['日付', 'セット数', '総負荷量(kg)', '最大重量(kg)', '推定1RM(kg)']}
      rows={[...series].reverse().map((p) => [mdw(p.date), `${p.sets}`, int(p.volume), kg(p.maxWeight), p.max1RM ? num(p.max1RM) : '—'])}
    />
  )
  const tip = (r: Record<string, unknown>) => mdw(String(r.date))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl label="集計の単位" value={mode} onChange={setMode} options={[{ value: 'part', label: '部位別' }, { value: 'exercise', label: '種目別' }]} />
        {mode === 'part' ? (
          <select value={part} onChange={(e) => setPart(e.target.value)} className={cn(inputClass, 'w-auto py-1.5 text-sm')} aria-label="部位">
            {partsWithData.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          <select value={exercise} onChange={(e) => setExercise(e.target.value)} className={cn(inputClass, 'w-auto max-w-full py-1.5 text-sm')} aria-label="種目">
            {partsWithData.map((p) => (
              <optgroup key={p} label={p}>
                {exercises
                  .filter(([, e]) => e.part === p)
                  .map(([name, e]) => (
                    <option key={name} value={name}>
                      {name}（{e.count}回）
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        )}
        <p className="text-xs text-ink-3">直近{count}回・基準日まで</p>
      </div>
      {series.length === 0 ? (
        <p className="rounded-xl bg-soft py-8 text-center text-sm text-ink-3">{subject} の記録はありません</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="総負荷量" subtitle={subject} table={table}>
            <SimpleBars data={series} dataKey="volume" name="総負荷量" unit="kg" height={170} tip={tip} />
          </ChartCard>
          <ChartCard title="推定1RM（最大）" subtitle={subject} table={table}>
            <SimpleBars data={series} dataKey="max1RM" name="推定1RM" unit="kg" height={170} tip={tip} />
          </ChartCard>
          <ChartCard title="セット数" subtitle={subject} table={table}>
            <SimpleBars data={series} dataKey="sets" name="セット数" unit="セット" height={170} tip={tip} />
          </ChartCard>
          <ChartCard title="最大重量" subtitle={subject} table={table}>
            <SimpleBars data={series} dataKey="maxWeight" name="最大重量" unit="kg" height={170} tip={tip} />
          </ChartCard>
        </div>
      )}
    </div>
  )
}
