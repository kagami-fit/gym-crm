import { prisma } from '@/lib/prisma'
import { fromDbDate, toDbDate, type Ymd } from '@/lib/dates'
import type { SessionRows } from '@/lib/calc/training'
import { isEmptyDrawing, parseDrawing, type DrawingData } from '@/lib/drawing'

export type SessionDetail = SessionRows & {
  id: string
  memo: string | null
  trainerName: string | null
  hasDrawing: boolean
  rows: Array<SessionRows['rows'][number] & { note: string | null }>
}

export async function getSessions(clientId: string, upTo?: Ymd): Promise<SessionDetail[]> {
  const rows = await prisma.trainingSession.findMany({
    where: { clientId, ...(upTo ? { date: { lte: toDbDate(upTo) } } : {}) },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { sets: { orderBy: { order: 'asc' } }, trainer: { select: { name: true } }, drawing: { select: { id: true } } },
  })
  return rows.map((s) => ({
    id: s.id,
    date: fromDbDate(s.date),
    memo: s.memo,
    trainerName: s.trainer?.name ?? null,
    hasDrawing: s.drawing != null,
    rows: s.sets.map((r) => ({ bodyPart: r.bodyPart, exercise: r.exercise, weightKg: r.weightKg, reps: r.reps, sets: r.sets, note: r.note })),
  }))
}

export type LastRecord = { date: Ymd; weightKg: number; reps: number; sets: number }

/** 種目ごとの前回の記録（指定日より前） */
export function lastRecordsBefore(sessions: SessionDetail[], date: Ymd, excludeSessionId?: string): Record<string, LastRecord> {
  const out: Record<string, LastRecord> = {}
  for (const s of sessions) {
    if (s.date >= date || s.id === excludeSessionId) continue
    for (const r of s.rows) out[r.exercise] = { date: s.date, weightKg: r.weightKg, reps: r.reps, sets: r.sets }
  }
  return out
}

export async function getExercises(activeOnly = true) {
  return prisma.exercise.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, bodyPart: true, name: true, sortOrder: true, active: true },
  })
}

/** 手書きメモ（表示用） */
export async function getDrawing(sessionId: string): Promise<DrawingData | null> {
  const d = await prisma.sessionDrawing.findUnique({ where: { sessionId } })
  if (!d) return null
  const data = parseDrawing(d.data)
  return isEmptyDrawing(data) ? null : data
}
