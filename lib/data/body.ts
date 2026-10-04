import { prisma } from '@/lib/prisma'
import { fromDbDate, toDbDate, type Ymd } from '@/lib/dates'

export type BodyPoint = { date: Ymd; weightKg: number | null; bodyFatPct: number | null; note: string | null }

export async function getBodyLogs(clientId: string, from: Ymd, to: Ymd): Promise<BodyPoint[]> {
  const rows = await prisma.bodyLog.findMany({
    where: { clientId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
    orderBy: { date: 'asc' },
  })
  return rows.map((r) => ({ date: fromDbDate(r.date), weightKg: r.weightKg, bodyFatPct: r.bodyFatPct, note: r.note }))
}

export type Latest = { value: number; date: Ymd } | null

/** 基準日以前で最新の体重・体脂肪率（それぞれ別の日でもよい） */
export async function getLatestBody(clientId: string, base: Ymd): Promise<{ weight: Latest; bodyFat: Latest }> {
  const [w, f] = await Promise.all([
    prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(base) }, weightKg: { not: null } }, orderBy: { date: 'desc' } }),
    prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(base) }, bodyFatPct: { not: null } }, orderBy: { date: 'desc' } }),
  ])
  return {
    weight: w?.weightKg != null ? { value: w.weightKg, date: fromDbDate(w.date) } : null,
    bodyFat: f?.bodyFatPct != null ? { value: f.bodyFatPct, date: fromDbDate(f.date) } : null,
  }
}

/** 食事方針と目標の履歴の1件（policy：lib/labels.ts の DIET_POLICIES。目標体重・ペース・活動係数は方針によっては空） */
export type GoalRow = {
  id: string
  startDate: Ymd
  policy: string
  policyName: string | null
  startWeightKg: number | null
  startBodyFatPct: number | null
  targetWeightKg: number | null
  paceKey: string | null
  activityFactor: number | null
  targetDate: Ymd | null
  endDate: Ymd | null
  reviewDate: Ymd | null
  note: string | null
  createdAt: Date
}

type GoalRecord = Omit<GoalRow, 'startDate' | 'targetDate' | 'endDate' | 'reviewDate'> & { startDate: Date; targetDate: Date | null; endDate: Date | null; reviewDate: Date | null }

export function toGoalRow(g: GoalRecord): GoalRow {
  return {
    id: g.id,
    startDate: fromDbDate(g.startDate),
    policy: g.policy,
    policyName: g.policyName,
    startWeightKg: g.startWeightKg,
    startBodyFatPct: g.startBodyFatPct,
    targetWeightKg: g.targetWeightKg,
    paceKey: g.paceKey,
    activityFactor: g.activityFactor,
    targetDate: g.targetDate ? fromDbDate(g.targetDate) : null,
    endDate: g.endDate ? fromDbDate(g.endDate) : null,
    reviewDate: g.reviewDate ? fromDbDate(g.reviewDate) : null,
    note: g.note,
    createdAt: g.createdAt,
  }
}

export async function getGoals(clientId: string): Promise<GoalRow[]> {
  const rows = await prisma.goal.findMany({ where: { clientId }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] })
  return rows.map(toGoalRow)
}

/** 基準日に有効な方針・目標（開始日が基準日以前で最新） */
export function goalAt(goals: GoalRow[], base: Ymd): GoalRow | null {
  return goals.find((g) => g.startDate <= base) ?? null
}

/** 目標の開始時体重（保存値がなければ開始日に一番近い記録） */
export async function resolveStartWeight(clientId: string, goal: GoalRow): Promise<number | null> {
  if (goal.startWeightKg != null) return goal.startWeightKg
  const before = await prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(goal.startDate) }, weightKg: { not: null } }, orderBy: { date: 'desc' } })
  if (before?.weightKg != null) return before.weightKg
  const after = await prisma.bodyLog.findFirst({ where: { clientId, date: { gte: toDbDate(goal.startDate) }, weightKg: { not: null } }, orderBy: { date: 'asc' } })
  return after?.weightKg ?? null
}
