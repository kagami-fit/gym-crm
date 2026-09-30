import { addDays, addMonthsKey, diffDays, monthKey, type Ymd } from '@/lib/dates'
import { phaseColors } from '@/lib/labels'

// 顧客ステップ（期と月ごとのテーマ）の計算。DB を使わないので、画面の部品やテストからも使える

/** 期。end は保存値、until は画面で使う終わり（空なら次の期の前日まで。最後の期は続いている＝null） */
export type PhaseRow = { id: string; name: string; start: Ymd; end: Ymd | null; until: Ymd | null; note: string | null; color: string }

/** 期の終わりを決める（空なら次の期の開始日の前日まで） */
export function resolvePhases(rows: Array<{ id: string; name: string; start: Ymd; end: Ymd | null; note: string | null }>): PhaseRow[] {
  const sorted = [...rows].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  const colors = phaseColors(sorted.map((p) => p.name))
  return sorted.map((p, i) => ({ ...p, until: p.end ?? (sorted[i + 1] ? addDays(sorted[i + 1].start, -1) : null), color: colors.get(p.name)! }))
}

/** その日の期（重なっているときは後から始まった期） */
export function phaseAt(phases: PhaseRow[], date: Ymd): PhaseRow | null {
  return [...phases].reverse().find((p) => p.start <= date && (p.until == null || date <= p.until)) ?? null
}

/** その月にかかっている期（月の途中で切り替わると2つ以上） */
export function phasesInMonth(phases: PhaseRow[], month: string): PhaseRow[] {
  const first = `${month}-01`
  const last = addDays(`${addMonthsKey(month, 1)}-01`, -1)
  return phases.filter((p) => p.start <= last && (p.until == null || p.until >= first))
}

/** 期の長さ（日数）。続いている期は基準日まで */
export function phaseDays(p: PhaseRow, base: Ymd): number {
  const end = p.until ?? (base > p.start ? base : p.start)
  return diffDays(p.start, end) + 1
}

export type ThemeRow = { month: string; theme: string | null; trainingTheme: string | null }

/** テーマを入れる月（入会月〜基準日の翌月。新しい月が上、最大12ヶ月） */
export function themeMonths(joinedOn: Ymd | null, base: Ymd): string[] {
  const last = addMonthsKey(monthKey(base), 1)
  const first = joinedOn ? monthKey(joinedOn) : addMonthsKey(monthKey(base), -5)
  const out: string[] = []
  for (let k = last; k >= first && out.length < 12; k = addMonthsKey(k, -1)) out.push(k)
  return out
}
