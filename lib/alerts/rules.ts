// 自動のお知らせの条件（データから計算するだけ。画面・保存は lib/data/alerts.ts）
import { diffDays, md, mdw, type Ymd } from '@/lib/dates'
import { int, num } from '@/lib/format'
import { talkKindOf } from '@/lib/labels'
import type { AlertSettings } from './settings'

/** info＝黄（気づき）／warn＝橙（要対応）／alert＝赤（相談） */
export type Level = 'info' | 'warn' | 'alert'
export const LEVELS: Record<Level, { label: string; rank: number }> = {
  info: { label: '気づき', rank: 1 },
  warn: { label: '要対応', rank: 2 },
  alert: { label: '相談', rank: 3 },
}
export const isLevel = (v: unknown): v is Level => typeof v === 'string' && v in LEVELS

export const RULES = {
  plateau: { label: '体重の停滞', tab: 'body' },
  noProgress: { label: '伸びていない種目', tab: 'training' },
  dietFlat: { label: '食事の変化なし', tab: 'meals' },
  noVisit: { label: '来店があいている', tab: '' },
  behindPace: { label: '予定ペースより遅れ', tab: 'body' },
  talk: { label: '気になる会話メモ', tab: 'talk' },
} as const
export type RuleKey = keyof typeof RULES
export const isRule = (v: unknown): v is RuleKey => typeof v === 'string' && v in RULES

/** 自動のお知らせ1件。fingerprint が同じあいだは「対応した」「あとで」が効く（状況や段階が変わるとまた出る） */
export type AutoAlert = { rule: RuleKey; level: Level; title: string; detail?: string; fingerprint: string; since?: Ymd }

/** 値がしきい値 [黄, 橙, 赤] のどこに入るか */
export function levelOf(value: number, [a, b, c]: [number, number, number]): Level | null {
  if (value >= c) return 'alert'
  if (value >= b) return 'warn'
  if (value >= a) return 'info'
  return null
}

/**
 * 体重の停滞：最低体重を何日更新していないか（直近90日の記録から）。
 * 最近の記録がない（10日以上あいている）ときは、停滞とは言えないので出さない（来店のお知らせに任せる）。
 */
export function plateau(points: Array<{ date: Ymd; kg: number }>, today: Ymd, s: AlertSettings['plateau']): AutoAlert | null {
  const pts = points.filter((p) => p.date <= today && diffDays(p.date, today) <= 90).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (pts.length < 4) return null
  const last = pts[pts.length - 1]
  if (diffDays(last.date, today) > 10) return null
  let min = Infinity
  let minDate = pts[0].date
  for (const p of pts) {
    if (p.kg < min - 0.05) {
      min = p.kg
      minDate = p.date
    }
  }
  const days = diffDays(minDate, today)
  const level = levelOf(days, s.days)
  if (!level) return null
  return {
    rule: 'plateau',
    level,
    title: `最低体重を${days}日更新していません`,
    detail: `最低 ${num(min)}kg（${md(minDate)}）／直近 ${num(last.kg)}kg（${md(last.date)}）`,
    fingerprint: `${minDate}:${level}`,
    since: minDate,
  }
}

type SessionLike = { id: string; date: Ymd; rows: Array<{ exercise: string; weightKg: number; reps: number }> }

/** 伸びていない種目：新しい回から見て、同じ重さ×回数が何回続いているか（今もやっている種目だけ） */
export function noProgress(sessions: SessionLike[], today: Ymd, s: AlertSettings['noProgress']): AutoAlert | null {
  const list = sessions.filter((x) => x.date <= today && x.rows.length > 0).sort((a, b) => (a.date < b.date ? 1 : -1))
  if (!list.length) return null
  const recentIds = new Set(list.slice(0, 2).map((x) => x.id))
  const byExercise = new Map<string, Array<{ id: string; w: number; r: number }>>()
  for (const x of list) {
    const seen = new Set<string>()
    for (const r of x.rows) {
      if (seen.has(r.exercise)) continue
      seen.add(r.exercise)
      const arr = byExercise.get(r.exercise) ?? []
      arr.push({ id: x.id, w: r.weightKg, r: r.reps })
      byExercise.set(r.exercise, arr)
    }
  }
  const hits: Array<{ exercise: string; count: number; w: number; r: number }> = []
  for (const [exercise, occ] of byExercise) {
    if (!recentIds.has(occ[0].id)) continue
    if (s.skipBodyweight && occ[0].w === 0) continue
    let count = 1
    while (count < occ.length && occ[count].w === occ[0].w && occ[count].r === occ[0].r) count++
    if (count >= s.counts[0]) hits.push({ exercise, count, w: occ[0].w, r: occ[0].r })
  }
  if (!hits.length) return null
  hits.sort((a, b) => b.count - a.count)
  const level = levelOf(hits[0].count, s.counts)!
  return {
    rule: 'noProgress',
    level,
    title: hits.length === 1 ? `${hits[0].exercise}が${hits[0].count}回続けて同じ重さ×回数です` : `${hits.length}種目が同じ重さ×回数のまま続いています`,
    detail: hits
      .slice(0, 4)
      .map((h) => `${h.exercise} ${h.w === 0 ? '自重' : `${num(h.w, h.w % 1 === 0 ? 0 : 1)}kg`}×${h.r}回（${h.count}回連続）`)
      .join('・'),
    fingerprint: `${list[0].id}:${level}`,
  }
}

export type WeekLike = { weekStart: Ymd; targetKcal: number | null; avgKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null }

/** 食事の変化なし：直近◯週間の平均カロリー・PFC がほぼ同じ（体重も停滞しているときだけ） */
export function dietFlat(weeks: WeekLike[], plateauActive: boolean, s: AlertSettings['dietFlat']): AutoAlert | null {
  if (!plateauActive) return null
  const recent = weeks.filter((w) => w.avgKcal != null).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).slice(0, s.weeks)
  if (recent.length < s.weeks) return null
  const flat = (vals: Array<number | null>) => {
    const v = vals.filter((x): x is number => x != null && x > 0)
    if (v.length < vals.length) return v.length === 0 // 入っていない項目は比べない
    return (Math.max(...v) - Math.min(...v)) / Math.max(...v) <= s.pct / 100
  }
  const ok = flat(recent.map((w) => w.avgKcal)) && flat(recent.map((w) => w.proteinG)) && flat(recent.map((w) => w.fatG)) && flat(recent.map((w) => w.carbsG))
  if (!ok) return null
  const w = recent[0]
  const pfc = [w.proteinG != null ? `P${int(w.proteinG)}` : null, w.fatG != null ? `F${int(w.fatG)}` : null, w.carbsG != null ? `C${int(w.carbsG)}` : null].filter(Boolean).join(' ')
  return {
    rule: 'dietFlat',
    level: 'warn',
    title: `食事の数字が${s.weeks}週間ほぼ同じです（体重も停滞）`,
    detail: `平均 ${int(w.avgKcal)}kcal${pfc ? `・${pfc}` : ''}${w.targetKcal != null ? `（設定 ${int(w.targetKcal)}kcal）` : ''}`,
    fingerprint: w.weekStart,
  }
}

/** 来店があいている（在籍中のお客様だけ） */
export function noVisit(lastVisit: Ymd | null, today: Ymd, s: AlertSettings['noVisit']): AutoAlert | null {
  if (!lastVisit) return null
  const days = diffDays(lastVisit, today)
  const level = levelOf(days, s.days)
  if (!level) return null
  return { rule: 'noVisit', level, title: `来店が${days}日あいています`, detail: `最後の来店 ${mdw(lastVisit)}`, fingerprint: `${lastVisit}:${level}`, since: lastVisit }
}

/** 予定ペースより遅れ（aheadKg がマイナス＝遅れ） */
export function behindPace(aheadKg: number | null, s: AlertSettings['behindPace']): AutoAlert | null {
  if (aheadKg == null || aheadKg >= 0) return null
  const behind = -aheadKg
  const level = levelOf(behind, s.kg)
  if (!level) return null
  return { rule: 'behindPace', level, title: `予定ペースより${num(behind)}kg遅れています`, detail: '目標の減量ペースと今の体重の差', fingerprint: level }
}

/** 気になる会話メモ（直近◯日のネガティブ・身体の変化） */
export function talk(notes: Array<{ id: string; date: Ymd; kind: string; text: string }>, today: Ymd, s: AlertSettings['talk']): AutoAlert | null {
  const recent = notes
    .filter((n) => (n.kind === 'negative' || n.kind === 'body') && n.date <= today && diffDays(n.date, today) < s.days)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  if (!recent.length) return null
  const n = recent[0]
  const text = n.text.length > 40 ? `${n.text.slice(0, 40)}…` : n.text
  return {
    rule: 'talk',
    level: 'info',
    title: recent.length === 1 ? `気になる会話メモ（${talkKindOf(n.kind).label}）` : `気になる会話メモが${recent.length}件`,
    detail: `「${text}」（${md(n.date)}）`,
    fingerprint: n.id,
    since: n.date,
  }
}
