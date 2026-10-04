import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { cleanConditionItems, type ConditionItems } from '@/lib/condition'
import { fromDbDate, type Ymd } from '@/lib/dates'
import { isWeightVerdict, type WeightVerdict } from '@/lib/labels'
import { MOVEMENTS, cleanChecks, isMovementStatus, movementOf, type MovementChecks, type MovementStatus } from '@/lib/movements'
import { ansState, checkpoints, overdueItems, visitsPerWeek, type OverdueItem } from '@/lib/plan'
import { getAnsMeasurements, type AnsRow } from './ans'
import { getGoals, goalAt, type GoalRow } from './body'
import { getPhases, phaseAt, type PhaseRow } from './steps'

// 指導計画（フェーズ・食事方針・自律神経・動作・体調・体重の評価）の読み込み。計算は lib/plan.ts

export type MovementCheckRow = { id: string; date: Ymd; movement: string; status: MovementStatus; checks: MovementChecks; condition: string | null; note: string | null }

/** 動作の評価（古い順） */
export async function getMovementChecks(clientId: string): Promise<MovementCheckRow[]> {
  const rows = await prisma.movementCheck.findMany({ where: { clientId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] })
  return rows.flatMap((r) => {
    const m = movementOf(r.movement)
    if (!m || !isMovementStatus(r.status)) return []
    return [{ id: r.id, date: fromDbDate(r.date), movement: r.movement, status: r.status, checks: cleanChecks(m, r.checks), condition: r.condition, note: r.note }]
  })
}

/** 動きごとの最新の評価（基準日まで） */
export function latestMovements(rows: MovementCheckRow[], base: Ymd): Record<string, MovementCheckRow | undefined> {
  const out: Record<string, MovementCheckRow | undefined> = {}
  for (const m of MOVEMENTS) out[m.key] = rows.filter((r) => r.movement === m.key && r.date <= base).at(-1)
  return out
}

export type ConditionRow = { id: string; date: Ymd; items: ConditionItems; painArea: string | null; note: string | null }

/** 体調チェック（古い順） */
export async function getConditionChecks(clientId: string): Promise<ConditionRow[]> {
  const rows = await prisma.conditionCheck.findMany({ where: { clientId }, orderBy: { date: 'asc' } })
  return rows.map((r) => ({ id: r.id, date: fromDbDate(r.date), items: cleanConditionItems(r.items), painArea: r.painArea, note: r.note }))
}

export type WeightReviewRow = { id: string; date: Ymd; verdict: WeightVerdict; reason: string | null }

/** 体重の評価（新しい順） */
export async function getWeightReviews(clientId: string): Promise<WeightReviewRow[]> {
  const rows = await prisma.weightReview.findMany({ where: { clientId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] })
  return rows.flatMap((r) => (isWeightVerdict(r.verdict) ? [{ id: r.id, date: fromDbDate(r.date), verdict: r.verdict, reason: r.reason }] : []))
}

/** 現在地（概要と指導計画の一番上） */
export type PlanView = {
  base: Ymd
  phases: PhaseRow[]
  phase: PhaseRow | null
  goals: GoalRow[]
  /** 基準日に有効な食事方針と目標 */
  policy: GoalRow | null
  /** 基準日までの自律神経の測定（新しい順） */
  ans: AnsRow[]
  ansNow: { state: ReturnType<typeof ansState>; latest: AnsRow | null; previous: AnsRow | null }
  movements: MovementCheckRow[]
  conditions: ConditionRow[]
  checkpoints: string[]
  overdue: OverdueItem[]
  /** 実際の来店ペース（週あたり） */
  visitsPerWeek: number | null
}

export const getPlanView = cache(async (clientId: string, base: Ymd): Promise<PlanView> => {
  const [phases, goals, ansAll, movements, conditions, visits] = await Promise.all([
    getPhases(clientId),
    getGoals(clientId),
    getAnsMeasurements(clientId),
    getMovementChecks(clientId),
    getConditionChecks(clientId),
    prisma.trainingSession.findMany({ where: { clientId }, select: { date: true }, orderBy: { date: 'desc' }, take: 120 }),
  ])
  const phase = phaseAt(phases, base)
  const policy = goalAt(goals, base)
  const ans = ansAll.filter((a) => a.measuredOn <= base)
  return {
    base,
    phases,
    phase,
    goals,
    policy,
    ans,
    ansNow: { state: ansState(ans[0] ?? null), latest: ans[0] ?? null, previous: ans[1] ?? null },
    movements,
    conditions: conditions.filter((c) => c.date <= base),
    checkpoints: checkpoints(phase?.name ?? null, policy?.policy ?? null),
    overdue: overdueItems(phases, policy, base),
    visitsPerWeek: visitsPerWeek(
      visits.map((v) => fromDbDate(v.date)),
      base,
    ),
  }
})
