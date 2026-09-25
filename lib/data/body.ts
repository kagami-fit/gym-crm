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

export type GoalRow = {
  id: string
  startDate: Ymd
  startWeightKg: number | null
  startBodyFatPct: number | null
  targetWeightKg: number
  paceKey: string
  activityFactor: number
  note: string | null
  createdAt: Date
}

export async function getGoals(clientId: string): Promise<GoalRow[]> {
  const rows = await prisma.goal.findMany({ where: { clientId }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] })
  return rows.map((g) => ({ ...g, startDate: fromDbDate(g.startDate) }))
}

/** 基準日に有効な目標（開始日が基準日以前で最新） */
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
