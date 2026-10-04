// 指導計画（フェーズ・食事方針・自律神経の評価・体重の評価・予定日）の計算。DB を使わないので、画面の部品やテストからも使える。
// 2026-10-04 の整理：自動で判定・分類しないもの（A〜Dの型、数値だけでの位置、フェーズの変更、5%に届かないことでの遅れ）は作らない。
import { addDays, diffDays, md, type Ymd } from '@/lib/dates'
import { ANS_LEVELS, PHASE_PRESETS, policyLabel, type AnsLevel } from '@/lib/labels'
import { phaseAt, type PhaseRow } from '@/lib/steps'

// ─────────────────────────────────────────────
// 自律神経（condiView の「活性度」：交感神経＝オレンジの棒、副交感神経＝青の棒）
// ─────────────────────────────────────────────

export type AnsReading = {
  sympathetic: number | null
  sympatheticLevel: AnsLevel | null
  parasympathetic: number | null
  parasympatheticLevel: AnsLevel | null
}
export type AnsState = 'good' | 'out' | 'unknown'

const NERVES = [
  { key: 'sympathetic', label: '交感神経' },
  { key: 'parasympathetic', label: '副交感神経' },
] as const

/**
 * 2本の位置から状態を決める。両方がそれぞれのグレーゾーン内のときだけ「良い状態」。
 * 総合点や自律神経バランスの点数は使わない。位置が未確認なら「未評価」。
 */
export function ansState(r: Pick<AnsReading, 'sympatheticLevel' | 'parasympatheticLevel'> | null): { state: AnsState; text: string } {
  if (!r) return { state: 'unknown', text: '未評価' }
  const s = r.sympatheticLevel
  const p = r.parasympatheticLevel
  if (!s && !p) return { state: 'unknown', text: '位置が未確認' }
  if (!s || !p) return { state: 'unknown', text: `${!s ? '交感神経' : '副交感神経'}の位置が未確認` }
  if (s === 'normal' && p === 'normal') return { state: 'good', text: '両方が基準内（良い状態）' }
  if (s === p) return { state: 'out', text: `交感神経・副交感神経がどちらも基準より${s === 'low' ? '低い' : '高い'}状態` }
  const parts = [s !== 'normal' ? ['交感神経', s] : null, p !== 'normal' ? ['副交感神経', p] : null].filter((x): x is [string, AnsLevel] => x != null)
  // 2つ並ぶときは「高く、〜低い」とつなぐ
  const text = parts.map(([name, lv], i) => `${name}が基準より${lv === 'low' ? (i < parts.length - 1 ? '低く' : '低い') : i < parts.length - 1 ? '高く' : '高い'}`).join('、')
  return { state: 'out', text: `${text}状態` }
}

/** 「交感神経は基準内、副交感神経は低い」の形 */
export function ansShort(r: Pick<AnsReading, 'sympatheticLevel' | 'parasympatheticLevel'> | null): string {
  const lv = (v: AnsLevel | null | undefined) => (v ? ANS_LEVELS[v].label : '未確認')
  return `交感神経は${lv(r?.sympatheticLevel)}、副交感神経は${lv(r?.parasympatheticLevel)}`
}

export type AnsChange = { label: string; from: number | null; to: number | null; delta: number | null; fromLevel: AnsLevel | null; toLevel: AnsLevel | null; moved: boolean }

/** 前回と今回の比較（数値の増減と、グレーゾーンとの位置の変化） */
export function ansChanges(prev: AnsReading | null, cur: AnsReading): AnsChange[] {
  return NERVES.map(({ key, label }) => {
    const levelKey = `${key}Level` as const
    const from = prev?.[key] ?? null
    const to = cur[key]
    const fromLevel = prev?.[levelKey] ?? null
    const toLevel = cur[levelKey]
    return { label, from, to, delta: from != null && to != null ? to - from : null, fromLevel, toLevel, moved: !!prev && fromLevel !== toLevel }
  })
}

// ─────────────────────────────────────────────
// 食事方針
// ─────────────────────────────────────────────

/** 方針の行（食事方針と目標の履歴の1件） */
export type PolicyLike = {
  id: string
  startDate: Ymd
  policy: string
  policyName: string | null
  targetWeightKg: number | null
  targetDate: Ymd | null
  endDate: Ymd | null
  reviewDate: Ymd | null
  note: string | null
}

/** 減量の目安（「予定ペースより遅れ」「体重の停滞」・3ヶ月で5% は減量のときだけ使う） */
export const isLossPolicy = (g: { policy: string } | null | undefined): boolean => g?.policy === 'loss'

/** コーフラックスの期間：終了予定日・目標日までの日数（マイナス＝過ぎている）と、終了後に減量に使える日数 */
export function reversePeriods(base: Ymd, endDate: Ymd | null, targetDate: Ymd | null): { toEnd: number | null; toTarget: number | null; afterEnd: number | null } {
  return {
    toEnd: endDate ? diffDays(base, endDate) : null,
    toTarget: targetDate ? diffDays(base, targetDate) : null,
    afterEnd: endDate && targetDate ? diffDays(endDate, targetDate) : null,
  }
}

// ─────────────────────────────────────────────
// 体重の評価
// ─────────────────────────────────────────────

/** 減少率（％）＝（比較元の体重 − 現在の体重）÷ 比較元の体重 × 100。プラスが減った */
export function weightChangePct(from: number, to: number): number {
  return ((from - to) / from) * 100
}

/** 週の減少がこの割合以上なら「速すぎないか確認」の材料として出す（会議の目安：週1%前後） */
export const FAST_WEEKLY_PCT = 1
/** 減量の参考目安（会議：3ヶ月で5%程度）。全員の目標として自動設定はしない */
export const GUIDE_PCT = 5
export const GUIDE_DAYS = 91

export type WeeklyChange = { date: Ymd; prevDate: Ymd; from: number; to: number; pct: number; fast: boolean }

/**
 * 週の変化：ちょうど7日前の記録がある日だけ比べる（7日と違う間隔の換算や、初期の水分変化の扱いは未確定なので作らない）。
 * 基準日から4週間以内で一番新しい組み合わせ。なければ null。
 */
export function weeklyChange(points: Array<{ date: Ymd; weightKg: number | null }>, base: Ymd): WeeklyChange | null {
  const byDate = new Map(points.filter((p) => p.weightKg != null).map((p) => [p.date, p.weightKg as number]))
  const dates = [...byDate.keys()].filter((d) => d <= base && d > addDays(base, -28)).sort().reverse()
  for (const d of dates) {
    const prevDate = addDays(d, -7)
    const from = byDate.get(prevDate)
    if (from == null) continue
    const to = byDate.get(d)!
    const pct = weightChangePct(from, to)
    return { date: d, prevDate, from, to, pct, fast: pct >= FAST_WEEKLY_PCT }
  }
  return null
}

/** 減量開始からの変化と、3ヶ月で5%の参考目安 */
export function lossGuide(startWeightKg: number, startDate: Ymd, current: { weightKg: number; date: Ymd }) {
  return {
    changeKg: startWeightKg - current.weightKg,
    changePct: weightChangePct(startWeightKg, current.weightKg),
    guideKg: (startWeightKg * GUIDE_PCT) / 100,
    guideWeightKg: startWeightKg * (1 - GUIDE_PCT / 100),
    elapsedDays: Math.max(0, diffDays(startDate, current.date)),
  }
}

// ─────────────────────────────────────────────
// 予定日を過ぎたもの（お知らせの「予定日を過ぎている」）
// ─────────────────────────────────────────────

export type OverdueItem = { key: string; label: string; date: Ymd; days: number }

/**
 * 基準日の時点で、予定日を過ぎているもの。
 * - 食事方針：コーフラックスの終了予定日・見直し予定日・目標日
 * - フェーズ：見直し予定日、終わりの日を決めたのに次のフェーズがないまま過ぎた
 * 過ぎた日数の多い順。
 */
export function overdueItems(phases: PhaseRow[], policy: PolicyLike | null, today: Ymd): OverdueItem[] {
  const out: OverdueItem[] = []
  const add = (key: string, label: string, date: Ymd | null) => {
    if (date && date < today) out.push({ key: `${key}:${date}`, label: `${label}（${md(date)}）`, date, days: diffDays(date, today) })
  }
  if (policy) {
    const name = policyLabel(policy.policy, policy.policyName)
    if (policy.policy === 'reverse') add(`policyEnd:${policy.id}`, `${name}の終了予定日`, policy.endDate)
    add(`policyReview:${policy.id}`, `${name}の見直し予定日`, policy.reviewDate)
    add(`targetDate:${policy.id}`, '目標日', policy.targetDate)
  }
  const now = phaseAt(phases, today)
  if (now) add(`phaseReview:${now.id}`, `${now.name}の見直し予定日`, now.reviewDate)
  else {
    const last = phases[phases.length - 1]
    if (last?.end && last.end < today) add(`phaseEnd:${last.id}`, `${last.name}の終わりの日`, last.end)
  }
  return out.sort((a, b) => b.days - a.days)
}

// ─────────────────────────────────────────────
// 現在地の「確認する点」・来店ペース・変更の履歴
// ─────────────────────────────────────────────

/** いまのフェーズと方針で、次の判断のために確認する点（表示案） */
export function checkpoints(phaseName: string | null, policy: string | null): string[] {
  if (phaseName === PHASE_PRESETS[0].name) return ['自律神経の推移', '痛み・疲労', '基礎動作の進捗']
  if (phaseName === PHASE_PRESETS[1].name || policy === 'reverse' || policy === 'loss' || policy === 'maintain') {
    if (policy === 'reverse') return ['体重を増やさずに摂取カロリーを上げられているか', '終了予定日までの残り']
    if (policy === 'loss') return ['体重の変化率', '週の減少が速すぎないか', '摂取カロリー']
    if (policy === 'maintain') return ['維持したい体重・状態との差']
    return ['食事方針を決める']
  }
  return ['フェーズと食事方針を決める']
}

/** 実際の来店ペース（週あたり）＝来店回数 ÷ 週数。直近8週（最初の来店から8週たっていなければ、最初の来店からの週数。端数の週は1週と数える） */
export function visitsPerWeek(visits: Ymd[], base: Ymd, weeks = 8): number | null {
  const past = [...new Set(visits.filter((d) => d <= base))]
  if (!past.length) return null
  const first = past.reduce((a, b) => (a < b ? a : b))
  const w = Math.ceil(Math.min(weeks * 7, diffDays(first, base) + 1) / 7)
  const from = addDays(base, -w * 7 + 1)
  const n = past.filter((d) => d >= from).length
  return Math.round((n / w) * 10) / 10
}

export type HistoryItem = { date: Ymd; kind: 'phase' | 'policy'; title: string; note: string | null }

/** フェーズ・食事方針の変更の履歴（新しい順） */
export function changeHistory(phases: PhaseRow[], policies: PolicyLike[]): HistoryItem[] {
  const items: HistoryItem[] = [
    ...phases.map((p) => ({ date: p.start, kind: 'phase' as const, title: `${p.name}へ`, note: p.note })),
    ...policies.map((g) => ({ date: g.startDate, kind: 'policy' as const, title: `食事方針：${policyLabel(g.policy, g.policyName)}`, note: g.note })),
  ]
  return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.kind === 'phase' ? -1 : 1))
}
