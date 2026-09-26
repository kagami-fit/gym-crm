import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fromDbDate, toDbDate, type Ymd } from '@/lib/dates'
import type { SessionRows } from '@/lib/calc/training'
import { drawingThumb, isEmptyDrawing, parseDrawing, parseThumb, type DrawingData, type DrawingThumb } from '@/lib/drawing'

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

/** 一覧に出す手書きメモの小さな表示（まだ作っていないものは、ここで作って保存する） */
export async function getMemoThumbs(sessionIds: string[]): Promise<Record<string, DrawingThumb>> {
  if (!sessionIds.length) return {}
  const rows = await prisma.sessionDrawing.findMany({ where: { sessionId: { in: sessionIds } }, select: { sessionId: true, thumb: true } })
  const out: Record<string, DrawingThumb> = {}
  const missing: string[] = []
  for (const r of rows) {
    const t = parseThumb(r.thumb)
    if (t) out[r.sessionId] = t
    else missing.push(r.sessionId)
  }
  if (missing.length) {
    const full = await prisma.sessionDrawing.findMany({ where: { sessionId: { in: missing } }, select: { sessionId: true, data: true } })
    for (const f of full) {
      const t = drawingThumb(parseDrawing(f.data))
      if (!t) continue
      out[f.sessionId] = t
      await prisma.sessionDrawing.update({ where: { sessionId: f.sessionId }, data: { thumb: t as unknown as Prisma.InputJsonValue } }).catch(() => undefined)
    }
  }
  return out
}
