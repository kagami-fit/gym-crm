import { plan, progress, projection, type Gender, type Plan, type Progress, type ProjectionRow } from '@/lib/calc/body'
import { findPace, type CalcSettings, type Pace } from '@/lib/calc/settings'
import { addDays, ageAt, fromDbDate, type Ymd } from '@/lib/dates'
import { getClient } from './clients'
import { getBodyLogs, getGoals, getLatestBody, goalAt, resolveStartWeight, type BodyPoint, type GoalRow, type Latest } from './body'
import { getCalcSettings } from './settings'

export type BodyView = {
  settings: CalcSettings
  base: Ymd
  age: number | null
  heightCm: number | null
  gender: Gender | null
  weight: Latest
  bodyFat: Latest
  goal: GoalRow | null
  goals: GoalRow[]
  pace: Pace | null
  plan: Plan
  progress: Progress | null
  months: ProjectionRow[]
  weeks: ProjectionRow[]
  /** 基準日から約6ヶ月前までの記録（グラフ用） */
  points: BodyPoint[]
}

/** 体重・目標まわりの計算をまとめて行う（概要・体重タブ・一覧で同じ結果になる） */
export async function getBodyView(clientId: string, base: Ymd): Promise<BodyView> {
  const [client, settings, latest, goals, points] = await Promise.all([
    getClient(clientId),
    getCalcSettings(),
    getLatestBody(clientId, base),
    getGoals(clientId),
    getBodyLogs(clientId, addDays(base, -200), base),
  ])
  const age = ageAt(client.birthDate ? fromDbDate(client.birthDate) : null, base)
  const gender = (client.gender as Gender | null) ?? null
  const goal = goalAt(goals, base)
  const pace = findPace(settings, goal?.paceKey)

  const p = plan(
    settings,
    { weightKg: latest.weight?.value ?? null, bodyFatPct: latest.bodyFat?.value ?? null, heightCm: client.heightCm, age, gender },
    { targetWeightKg: goal?.targetWeightKg ?? null, pace, activityFactor: goal?.activityFactor ?? null },
  )

  let months: ProjectionRow[] = []
  let weeks: ProjectionRow[] = []
  if (goal && latest.weight && p.dailyDeficit != null) {
    const args = { baseDate: base, weightKg: latest.weight.value, fatMassKg: p.composition.fatMassKg, targetWeightKg: goal.targetWeightKg, dailyDeficit: p.dailyDeficit }
    months = projection(settings, args, 'month', 6)
    weeks = projection(settings, args, 'week', 10)
  }

  let prog: Progress | null = null
  if (goal && pace && latest.weight) {
    const startWeight = await resolveStartWeight(clientId, goal)
    if (startWeight != null) {
      prog = progress(settings, { startDate: goal.startDate, startWeightKg: startWeight, targetWeightKg: goal.targetWeightKg, pace, baseDate: base, currentWeightKg: latest.weight.value })
    }
  }

  return { settings, base, age, heightCm: client.heightCm, gender, weight: latest.weight, bodyFat: latest.bodyFat, goal, goals, pace, plan: p, progress: prog, months, weeks, points }
}
