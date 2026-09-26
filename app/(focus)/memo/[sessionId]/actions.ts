'use server'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { drawingThumb, isEmptyDrawing, parseDrawing } from '@/lib/drawing'

/** 手書きメモの保存（画面から数秒ごとに自動で呼ばれる。全部消したら記録も消す） */
export async function saveDrawingAction(sessionId: string, json: string): Promise<{ ok: boolean; message?: string; savedAt?: string }> {
  const user = await requireUser()
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId }, select: { id: true } })
  if (!session) return { ok: false, message: 'この記録は見つかりませんでした' }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { ok: false, message: '送信内容を読み取れませんでした' }
  }
  const data = parseDrawing(raw)
  if (isEmptyDrawing(data)) {
    await prisma.sessionDrawing.deleteMany({ where: { sessionId } })
  } else {
    const value = data as unknown as Prisma.InputJsonValue
    const thumb = (drawingThumb(data) ?? undefined) as unknown as Prisma.InputJsonValue | undefined
    await prisma.sessionDrawing.upsert({ where: { sessionId }, update: { data: value, thumb, updatedById: user.id }, create: { sessionId, data: value, thumb, updatedById: user.id } })
  }
  const savedAt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(new Date())
  return { ok: true, savedAt }
}
