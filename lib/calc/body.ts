// 体組成・目標カロリー・減量予測の計算（全画面がここを使う＝結果が必ずそろう）
import { addDays, diffDays, type Ymd } from '../dates'
import { DAYS_PER_MONTH, type CalcSettings, type Pace } from './settings'

export type Gender = 'male' | 'female' | 'other'

export type BodyInput = {
  weightKg: number | null
  bodyFatPct: number | null
  heightCm: number | null
  age: number | null
  gender: Gender | null
}

export type GoalInput = {
  targetWeightKg: number | null
  pace: Pace | null
  activityFactor: number | null
}

export type Composition = {
  bmi: number | null
  fatMassKg: number | null
  leanMassKg: number | null
  idealWeight22: number | null
  idealWeight20: number | null
}

const has = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)

export function composition(b: BodyInput): Composition {
  const h = has(b.heightCm) && b.heightCm > 0 ? b.heightCm / 100 : null
  const bmi = h && has(b.weightKg) ? b.weightKg / (h * h) : null
  const fatMassKg = has(b.weightKg) && has(b.bodyFatPct) ? (b.weightKg * b.bodyFatPct) / 100 : null
  const leanMassKg = fatMassKg != null && has(b.weightKg) ? b.weightKg - fatMassKg : null
  return {
    bmi,
    fatMassKg,
    leanMassKg,
    idealWeight22: h ? h * h * 22 : null,
    idealWeight20: h ? h * h * 20 : null,
  }
}

export type BmrResult = { value: number | null; missing: string[] }

function missingOf(b: BodyInput, fields: Array<'weight' | 'bodyFat' | 'height' | 'age' | 'gender'>): string[] {
  const out: string[] = []
  if (fields.includes('weight') && !has(b.weightKg)) out.push('体重')
  if (fields.includes('bodyFat') && !has(b.bodyFatPct)) out.push('体脂肪率')
  if (fields.includes('height') && !has(b.heightCm)) out.push('身長')
  if (fields.includes('age') && !has(b.age)) out.push('生年月日')
  if (fields.includes('gender') && !b.gender) out.push('性別')
  return out
}

/** 男女で式が違うものは、性別「その他」のとき男女の平均を使う */
function byGender(g: Gender, male: number, female: number): number {
  if (g === 'male') return male
  if (g === 'female') return female
  return (male + female) / 2
}

export function basalMetabolism(s: CalcSettings, b: BodyInput, comp: Composition = composition(b)): BmrResult {
  switch (s.bmrMethod) {
    case 'lbm':
      return comp.leanMassKg != null
        ? { value: comp.leanMassKg * s.bmrLbmFactor, missing: [] }
        : { value: null, missing: missingOf(b, ['weight', 'bodyFat']) }
    case 'katch':
      return comp.leanMassKg != null
        ? { value: 370 + 21.6 * comp.leanMassKg, missing: [] }
        : { value: null, missing: missingOf(b, ['weight', 'bodyFat']) }
    case 'ganpule': {
      const missing = missingOf(b, ['weight', 'height', 'age', 'gender'])
      if (missing.length) return { value: null, missing }
      const k = byGender(b.gender!, 0.4235, 0.5473)
      return { value: ((0.0481 * b.weightKg! + 0.0234 * b.heightCm! - 0.0138 * b.age! - k) * 1000) / 4.186, missing: [] }
    }
    case 'harris': {
      const missing = missingOf(b, ['weight', 'height', 'age', 'gender'])
      if (missing.length) return { value: null, missing }
      const w = b.weightKg!, h = b.heightCm!, a = b.age!
      return {
        value: byGender(b.gender!, 13.397 * w + 4.799 * h - 5.677 * a + 88.362, 9.247 * w + 3.098 * h - 4.33 * a + 447.593),
        missing: [],
      }
    }
  }
}

export type Plan = {
  composition: Composition
  bmr: number | null
  tdee: number | null
  /** 1日の削減カロリー（目標達成済みなら0） */
  dailyDeficit: number | null
  targetKcal: number | null
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
  pfcKcal: { carbs: number; fat: number; protein: number } | null
  waterMl: number | null
  meatG: number | null
  riceG: number | null
  /** 現体重 − 目標体重（マイナス＝目標より軽い） */
  lossKg: number | null
  totalDeficitKcal: number | null
  daysToGoal: number | null
  target: { bmi: number | null; bodyFatPct: number | null; fatMassKg: number | null; leanMassKg: number | null } | null
  missing: string[]
  warnings: string[]
}

export function plan(s: CalcSettings, b: BodyInput, g: GoalInput): Plan {
  const comp = composition(b)
  const bmrR = basalMetabolism(s, b, comp)
  const missing = [...bmrR.missing]
  const warnings: string[] = []

  const bmr = bmrR.value
  const tdee = bmr != null && has(g.activityFactor) ? bmr * g.activityFactor : null
  if (!has(g.activityFactor)) missing.push('活動係数')

  const hasGoal = has(g.targetWeightKg) && g.pace != null
  const lossKg = has(b.weightKg) && has(g.targetWeightKg) ? b.weightKg - g.targetWeightKg : null
  let dailyDeficit: number | null = null
  if (hasGoal && has(b.weightKg)) {
    dailyDeficit = lossKg != null && lossKg <= 0 ? 0 : (b.weightKg * (g.pace!.percentPerMonth / 100) * s.kcalPerKgFat) / DAYS_PER_MONTH
  }
  const targetKcal = tdee != null ? tdee - (dailyDeficit ?? 0) : null

  const proteinBase = s.proteinBasis === 'lbm' ? comp.leanMassKg : b.weightKg
  const proteinG = has(proteinBase) ? proteinBase * s.proteinPerKg : null
  const fatG = targetKcal != null ? (targetKcal * (s.fatRatioPct / 100)) / 9 : null
  const carbsG = targetKcal != null && proteinG != null && fatG != null ? (targetKcal - proteinG * 4 - fatG * 9) / 4 : null
  if (carbsG != null && carbsG < 0) warnings.push('たんぱく質と脂質だけで目標カロリーを超えています。設定か目標を見直してください')

  const pfcKcal =
    proteinG != null && fatG != null && carbsG != null ? { carbs: Math.max(0, carbsG * 4), fat: fatG * 9, protein: proteinG * 4 } : null

  const totalDeficitKcal = lossKg != null ? Math.max(0, lossKg) * s.kcalPerKgFat : null
  let daysToGoal: number | null = null
  if (lossKg != null && lossKg <= 0) daysToGoal = 0
  else if (totalDeficitKcal != null && dailyDeficit != null && dailyDeficit > 0) daysToGoal = totalDeficitKcal / dailyDeficit

  let target: Plan['target'] = null
  if (has(g.targetWeightKg)) {
    const h = has(b.heightCm) && b.heightCm > 0 ? b.heightCm / 100 : null
    const loss = Math.max(0, lossKg ?? 0)
    const fatT = comp.fatMassKg != null ? comp.fatMassKg - loss : null
    target = {
      bmi: h ? g.targetWeightKg / (h * h) : null,
      fatMassKg: fatT,
      leanMassKg: comp.leanMassKg,
      bodyFatPct: fatT != null ? (fatT / g.targetWeightKg) * 100 : null,
    }
    if (comp.leanMassKg != null && g.targetWeightKg <= comp.leanMassKg) {
      warnings.push(`目標体重が除脂肪体重（${comp.leanMassKg.toFixed(1)}kg）以下です。体脂肪率がマイナスになるため見直してください`)
    } else if (target.bmi != null && target.bmi < 18.5) {
      warnings.push('目標体重のBMIが18.5未満（低体重）です')
    }
  }

  return {
    composition: comp,
    bmr,
    tdee,
    dailyDeficit,
    targetKcal,
    proteinG,
    fatG,
    carbsG,
    pfcKcal,
    waterMl: has(b.weightKg) ? b.weightKg * s.waterMlPerKg : null,
    meatG: proteinG != null ? (proteinG / s.meatProteinPer100g) * 100 : null,
    riceG: carbsG != null ? (Math.max(0, carbsG) / s.riceCarbsPer100g) * 100 : null,
    lossKg,
    totalDeficitKcal,
    daysToGoal,
    target,
    missing: [...new Set(missing)],
    warnings,
  }
}

export type ProjectionRow = {
  label: string
  date: Ymd
  periodDeficitKcal: number
  periodLossKg: number
  weightKg: number
  bodyFatPct: number | null
  fatMassKg: number | null
  reached: boolean
}

/**
 * 減量の予測。1日の削減カロリーが続いたとして、減った分はすべて体脂肪とみなす。
 * 目標体重に届いたらそこで止める（目標達成日と必ず一致する）。
 */
export function projection(
  s: CalcSettings,
  p: { baseDate: Ymd; weightKg: number; fatMassKg: number | null; targetWeightKg: number; dailyDeficit: number },
  unit: 'month' | 'week',
  count: number,
): ProjectionRow[] {
  const step = unit === 'month' ? DAYS_PER_MONTH : 7
  const maxLoss = Math.max(0, p.weightKg - p.targetWeightKg)
  const rows: ProjectionRow[] = []
  let prevLoss = 0
  for (let i = 1; i <= count; i++) {
    const days = step * i
    const loss = Math.min((p.dailyDeficit * days) / s.kcalPerKgFat, maxLoss)
    const w = p.weightKg - loss
    const fm = p.fatMassKg != null ? Math.max(0, p.fatMassKg - loss) : null
    rows.push({
      label: unit === 'month' ? `${i}ヶ月後` : `${i}週間後`,
      date: addDays(p.baseDate, days),
      periodDeficitKcal: (loss - prevLoss) * s.kcalPerKgFat,
      periodLossKg: loss - prevLoss,
      weightKg: w,
      bodyFatPct: fm != null && w > 0 ? (fm / w) * 100 : null,
      fatMassKg: fm,
      reached: loss >= maxLoss - 1e-9,
    })
    prevLoss = loss
  }
  return rows
}

export type Progress = {
  startDate: Ymd
  startWeightKg: number
  currentWeightKg: number
  targetWeightKg: number
  /** 開始から減った量（マイナス＝増えた） */
  achievedKg: number
  totalKg: number
  /** 目標までの達成率（0〜100、目標が「増量」やゼロのときは null） */
  progressPct: number | null
  remainingKg: number
  elapsedDays: number
  /** 予定ペースどおりなら今日時点で何kgか */
  plannedWeightKg: number
  /** 予定より何kg先行しているか（プラス＝予定より順調） */
  aheadKg: number
  /** 開始時の予定での目標達成日 */
  plannedGoalDate: Ymd | null
}

export function progress(
  s: CalcSettings,
  p: { startDate: Ymd; startWeightKg: number; targetWeightKg: number; pace: Pace; baseDate: Ymd; currentWeightKg: number },
): Progress {
  const totalKg = p.startWeightKg - p.targetWeightKg
  const achievedKg = p.startWeightKg - p.currentWeightKg
  const elapsedDays = Math.max(0, diffDays(p.startDate, p.baseDate))
  const dailyLossKg = (p.startWeightKg * (p.pace.percentPerMonth / 100)) / DAYS_PER_MONTH
  const plannedWeightKg = totalKg > 0 ? Math.max(p.targetWeightKg, p.startWeightKg - dailyLossKg * elapsedDays) : p.startWeightKg
  const plannedDays = totalKg > 0 && dailyLossKg > 0 ? Math.ceil(totalKg / dailyLossKg) : null
  return {
    startDate: p.startDate,
    startWeightKg: p.startWeightKg,
    currentWeightKg: p.currentWeightKg,
    targetWeightKg: p.targetWeightKg,
    achievedKg,
    totalKg,
    progressPct: totalKg > 0 ? Math.min(100, Math.max(0, (achievedKg / totalKg) * 100)) : null,
    remainingKg: Math.max(0, p.currentWeightKg - p.targetWeightKg),
    elapsedDays,
    plannedWeightKg,
    aheadKg: plannedWeightKg - p.currentWeightKg,
    plannedGoalDate: plannedDays != null ? addDays(p.startDate, plannedDays) : null,
  }
}
