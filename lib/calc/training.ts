// トレーニング記録の計算と集計（総負荷量・推定1RM・部位別・種目別）
import { addMonthsKey, monthKey, type Ymd } from '../dates'
import type { OneRmMethod } from './settings'

export type SetRow = { bodyPart: string; exercise: string; weightKg: number; reps: number; sets: number }
export type SessionRows = { id?: string; date: Ymd; rows: SetRow[] }

export function volume(r: Pick<SetRow, 'weightKg' | 'reps' | 'sets'>): number {
  return r.weightKg * r.reps * r.sets
}

/** 推定1RM（最大挙上重量）。回数が多すぎて式が使えないときは null */
export function estimate1RM(method: OneRmMethod, weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps > 0)) return null
  if (reps === 1) return weightKg
  switch (method) {
    case 'oconner':
      return weightKg * (1 + reps / 40)
    case 'epley':
      return weightKg * (1 + reps / 30)
    case 'brzycki':
      return reps < 37 ? (weightKg * 36) / (37 - reps) : null
  }
}

export type SessionSummary = {
  date: Ymd
  volume: number
  totalSets: number
  exerciseCount: number
  bodyParts: string[]
}

export function summarize(s: SessionRows): SessionSummary {
  return {
    date: s.date,
    volume: s.rows.reduce((a, r) => a + volume(r), 0),
    totalSets: s.rows.reduce((a, r) => a + r.sets, 0),
    exerciseCount: new Set(s.rows.map((r) => r.exercise)).size,
    bodyParts: [...new Set(s.rows.map((r) => r.bodyPart))],
  }
}

/** 基準日までの、種目の記録がある回（手書きメモだけの回は集計に入れない） */
function upTo(sessions: SessionRows[], base: Ymd): SessionRows[] {
  return sessions.filter((s) => s.date <= base && s.rows.length > 0).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** 基準日までの直近 count 回の総負荷量（古い順）。同じ日に2回あれば合算 */
export function recentVolumes(sessions: SessionRows[], base: Ymd, count: number): Array<{ date: Ymd; volume: number }> {
  const byDate = new Map<Ymd, number>()
  for (const s of upTo(sessions, base)) byDate.set(s.date, (byDate.get(s.date) ?? 0) + summarize(s).volume)
  return [...byDate.entries()].slice(-count).map(([date, v]) => ({ date, volume: v }))
}

/** 基準日の月までの months ヶ月分の「1回あたりの総負荷量」（古い順。記録のない月は null） */
export function monthlyAverages(
  sessions: SessionRows[],
  base: Ymd,
  months: number,
): Array<{ month: string; sessions: number; total: number; average: number | null }> {
  const last = monthKey(base)
  const keys = Array.from({ length: months }, (_, i) => addMonthsKey(last, i - (months - 1)))
  const agg = new Map(keys.map((k) => [k, { sessions: 0, total: 0 }]))
  for (const s of upTo(sessions, base)) {
    const a = agg.get(monthKey(s.date))
    if (!a) continue
    a.sessions += 1
    a.total += summarize(s).volume
  }
  return keys.map((k) => {
    const a = agg.get(k)!
    return { month: k, sessions: a.sessions, total: a.total, average: a.sessions ? a.total / a.sessions : null }
  })
}

export type MetricPoint = { date: Ymd; sets: number; volume: number; maxWeight: number; max1RM: number | null }

/** 部位または種目を指定して、基準日までの直近 count 回の4指標（セット数・総負荷量・最大重量・最大RM） */
export function metricSeries(
  sessions: SessionRows[],
  filter: { bodyPart?: string; exercise?: string },
  base: Ymd,
  count: number,
  method: OneRmMethod,
): MetricPoint[] {
  const byDate = new Map<Ymd, MetricPoint>()
  for (const s of upTo(sessions, base)) {
    const rows = s.rows.filter(
      (r) => (filter.bodyPart == null || r.bodyPart === filter.bodyPart) && (filter.exercise == null || r.exercise === filter.exercise),
    )
    if (!rows.length) continue
    const p = byDate.get(s.date) ?? { date: s.date, sets: 0, volume: 0, maxWeight: 0, max1RM: null }
    for (const r of rows) {
      p.sets += r.sets
      p.volume += volume(r)
      p.maxWeight = Math.max(p.maxWeight, r.weightKg)
      const rm = estimate1RM(method, r.weightKg, r.reps)
      if (rm != null) p.max1RM = Math.max(p.max1RM ?? 0, rm)
    }
    byDate.set(s.date, p)
  }
  return [...byDate.values()].slice(-count)
}
