'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'
import { toNumberOrNull, textOrNull } from '@/lib/format'
import { isWeightVerdict } from '@/lib/labels'
import type { ActionState } from '@/components/SubmitButton'

const fail = (message: string): ActionState => ({ ok: false, message, at: Date.now() })

/** 7日分の体重・体脂肪率をまとめて保存（両方空の日は記録を消す） */
export async function saveBodyWeekAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser()
  const dates = String(fd.get('dates') ?? '').split(',').filter(isYmd).slice(0, 31)
  if (!dates.length) return fail('日付が正しくありません')
  let saved = 0
  for (const d of dates) {
    const w = toNumberOrNull(fd.get(`w_${d}`))
    const f = toNumberOrNull(fd.get(`f_${d}`))
    const note = textOrNull(fd.get(`n_${d}`))?.slice(0, 200) ?? null
    if (w != null && (w < 20 || w > 250)) return fail(`${d} の体重は20〜250kgで入れてください`)
    if (f != null && (f < 2 || f > 70)) return fail(`${d} の体脂肪率は2〜70%で入れてください`)
    const where = { clientId_date: { clientId, date: toDbDate(d) } }
    if (w == null && f == null && !note) {
      await prisma.bodyLog.deleteMany({ where: { clientId, date: toDbDate(d) } })
      continue
    }
    await prisma.bodyLog.upsert({ where, update: { weightKg: w, bodyFatPct: f, note }, create: { clientId, date: toDbDate(d), weightKg: w, bodyFatPct: f, note } })
    saved++
  }
  revalidatePath(`/clients/${clientId}`, 'layout')
  revalidatePath('/clients')
  return { ok: true, message: `${saved}日分を保存しました`, at: Date.now() }
}

/** 体重の変化への担当者の評価（想定内／見直しが必要／評価保留）と理由 */
export async function saveWeightReviewAction(clientId: string, input: { date: string; verdict: string; reason?: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser()
  if (!isYmd(input.date)) return { ok: false, message: '日付を選んでください' }
  if (!isWeightVerdict(input.verdict)) return { ok: false, message: '評価を選んでください' }
  if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return { ok: false, message: 'お客様が見つかりませんでした' }
  await prisma.weightReview.create({ data: { clientId, date: toDbDate(input.date), verdict: input.verdict, reason: input.reason?.trim().slice(0, 200) || null, createdById: user.id } })
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true }
}

export async function deleteWeightReviewAction(clientId: string, id: string): Promise<{ ok: true }> {
  await requireUser()
  await prisma.weightReview.deleteMany({ where: { id, clientId } })
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true }
}
