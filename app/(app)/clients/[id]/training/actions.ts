'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { cleanDetail, detailSummary, isRating, normalizeSprings } from '@/lib/log'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'
import type { ActionState } from '@/components/SubmitButton'

const rowSchema = z
  .object({
    bodyPart: z.string().trim().min(1, '部位を選んでください').max(20),
    exercise: z.string().trim().min(1, '種目を選ぶか入力してください').max(60),
    weightKg: z.number().min(0, '重さは0以上にしてください').max(500, '重さが大きすぎます').nullable().optional(),
    reps: z.number().int('回数は整数で入れてください').min(0).max(500).nullable().optional(),
    sets: z.number().int('セット数は整数で入れてください').min(0).max(30).nullable().optional(),
    note: z.string().trim().max(200).nullable().optional(),
    purpose: z.string().trim().max(20).nullable().optional(),
    equipment: z.string().trim().max(20).nullable().optional(),
    springs: z.string().trim().max(40).nullable().optional(),
    detail: z.unknown().optional(),
    rating: z.string().nullable().optional(),
  })
  .transform((r, ctx) => {
    // セットごとに入れたときは、一番重いセットとセット数を「まとめ」にする
    const detail = cleanDetail(r.detail)
    if (detail.length) return { ...r, detail, ...detailSummary(detail) }
    if (r.weightKg == null || !Number.isFinite(r.weightKg)) ctx.addIssue({ code: 'custom', message: '重さを入れてください（自重は0）' })
    if (!r.reps || r.reps < 1) ctx.addIssue({ code: 'custom', message: '回数は1以上にしてください' })
    if (!r.sets || r.sets < 1) ctx.addIssue({ code: 'custom', message: 'セット数は1以上にしてください' })
    return { ...r, detail: null, weightKg: r.weightKg ?? 0, reps: r.reps ?? 0, sets: r.sets ?? 0 }
  })
const payloadSchema = z.object({
  date: z.string().refine(isYmd, '日付が正しくありません'),
  memo: z.string().trim().max(1000).nullable().optional(),
  theme: z.string().trim().max(60).nullable().optional(),
  rows: z.array(rowSchema).max(40),
})

export async function saveSessionAction(clientId: string, sessionId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  let raw: unknown
  try {
    raw = JSON.parse(String(fd.get('payload') ?? '{}'))
  } catch {
    return { ok: false, message: '送信内容を読み取れませんでした', at: Date.now() }
  }
  const r = payloadSchema.safeParse(raw)
  if (!r.success) {
    const issue = r.error.issues[0]
    const rowNo = issue?.path[0] === 'rows' && typeof issue.path[1] === 'number' ? `${issue.path[1] + 1}行目：` : ''
    return { ok: false, message: `${rowNo}${issue?.message ?? '入力内容を確認してください'}`, at: Date.now() }
  }
  const { date, memo, theme, rows } = r.data
  if (!rows.length && !theme && !memo) return { ok: false, message: '種目かテーマ・メモを入れてください', at: Date.now() }
  const sets = rows.map((x, order) => ({
    order,
    bodyPart: x.bodyPart,
    exercise: x.exercise,
    weightKg: x.weightKg,
    reps: x.reps,
    sets: x.sets,
    note: x.note || null,
    purpose: x.purpose || null,
    equipment: x.equipment || null,
    springs: x.springs ? normalizeSprings(x.springs) || null : null,
    detail: x.detail ?? Prisma.DbNull,
    rating: isRating(x.rating) ? x.rating : null,
  }))

  if (sessionId) {
    const exists = await prisma.trainingSession.findFirst({ where: { id: sessionId, clientId }, select: { id: true } })
    if (!exists) return { ok: false, message: 'この記録は見つかりませんでした', at: Date.now() }
    await prisma.$transaction([
      prisma.trainingSet.deleteMany({ where: { sessionId } }),
      prisma.trainingSession.update({ where: { id: sessionId }, data: { date: toDbDate(date), memo: memo || null, theme: theme || null, sets: { create: sets } } }),
    ])
  } else {
    await prisma.trainingSession.create({ data: { clientId, date: toDbDate(date), memo: memo || null, theme: theme || null, trainerId: user.id, sets: { create: sets } } })
  }
  revalidatePath(`/clients/${clientId}`, 'layout')
  revalidatePath('/clients')
  redirect(`/clients/${clientId}/training?date=${date}&saved=1`)
}

export async function deleteSessionAction(clientId: string, sessionId: string, date: string) {
  await requireUser()
  await prisma.trainingSession.deleteMany({ where: { id: sessionId, clientId } })
  revalidatePath(`/clients/${clientId}`, 'layout')
  redirect(`/clients/${clientId}/training?date=${isYmd(date) ? date : ''}&deleted=1`)
}

/** 手書きメモを開く。その日の記録がまだなければ（手書きメモだけの回として）作ってから開く */
export async function openMemoAction(clientId: string, date: string) {
  const user = await requireUser()
  if (!isYmd(date)) return
  const existing = await prisma.trainingSession.findFirst({ where: { clientId, date: toDbDate(date) }, orderBy: { createdAt: 'desc' }, select: { id: true } })
  const id = existing?.id ?? (await prisma.trainingSession.create({ data: { clientId, date: toDbDate(date), trainerId: user.id }, select: { id: true } })).id
  redirect(`/memo/${id}`)
}
