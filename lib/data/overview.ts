import { plan, progress, projection, type Gender, type Plan, type Progress, type ProjectionRow } from '@/lib/calc/body'
import { findPace, type CalcSettings, type Pace } from '@/lib/calc/settings'
import { addDays, ageAt, fromDbDate, type Ymd } from '@/lib/dates'
import { isLossPolicy } from '@/lib/plan'
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
  /** 基準日に有効な食事方針と目標 */
  goal: GoalRow | null
  goals: GoalRow[]
  /** 減量ペース（食事方針が減量のときだけ） */
  pace: Pace | null
  plan: Plan
  progress: Progress | null
  months: ProjectionRow[]
  weeks: ProjectionRow[]
  /** 基準日から約1年前までの記録（グラフ用。「はじめから」の週平均は最大52週） */
  points: BodyPoint[]
}

/** 体重・目標まわりの計算をまとめて行う（概要・体重タブ・一覧で同じ結果になる） */
export async function getBodyView(clientId: string, base: Ymd): Promise<BodyView> {
  const [client, settings, latest, goals, points] = await Promise.all([
    getClient(clientId),
    getCalcSettings(),
    getLatestBody(clientId, base),
    getGoals(clientId),
    getBodyLogs(clientId, addDays(base, -370), base),
  ])
  const age = ageAt(client.birthDate ? fromDbDate(client.birthDate) : null, base)
  const gender = (client.gender as Gender | null) ?? null
  const goal = goalAt(goals, base)
  // 減量ペース（と予測・予定ペースとの差）は、食事方針が「減量」のときだけ使う
  const loss = isLossPolicy(goal)
  const pace = loss ? findPace(settings, goal?.paceKey) : null

  const p = plan(
    settings,
    { weightKg: latest.weight?.value ?? null, bodyFatPct: latest.bodyFat?.value ?? null, heightCm: client.heightCm, age, gender },
    { targetWeightKg: goal?.targetWeightKg ?? null, pace, activityFactor: goal?.activityFactor ?? null },
  )

  let months: ProjectionRow[] = []
  let weeks: ProjectionRow[] = []
  if (goal?.targetWeightKg != null && latest.weight && p.dailyDeficit != null) {
    const args = { baseDate: base, weightKg: latest.weight.value, fatMassKg: p.composition.fatMassKg, targetWeightKg: goal.targetWeightKg, dailyDeficit: p.dailyDeficit }
    months = projection(settings, args, 'month', 6)
    weeks = projection(settings, args, 'week', 10)
  }

  let prog: Progress | null = null
  if (goal?.targetWeightKg != null && pace && latest.weight) {
    const startWeight = await resolveStartWeight(clientId, goal)
    if (startWeight != null) {
      prog = progress(settings, { startDate: goal.startDate, startWeightKg: startWeight, targetWeightKg: goal.targetWeightKg, pace, baseDate: base, currentWeightKg: latest.weight.value })
    }
  }

  return { settings, base, age, heightCm: client.heightCm, gender, weight: latest.weight, bodyFat: latest.bodyFat, goal, goals, pace, plan: p, progress: prog, months, weeks, points }
}
