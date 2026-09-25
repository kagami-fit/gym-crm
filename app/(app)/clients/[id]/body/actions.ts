'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'
import { toNumberOrNull, textOrNull } from '@/lib/format'
import { getCalcSettings } from '@/lib/data/settings'
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

/** 目標を追加（変更のたびに新しい行を追加して履歴にする） */
export async function addGoalAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const settings = await getCalcSettings()
  const startDate = String(fd.get('startDate') ?? '')
  const target = toNumberOrNull(fd.get('targetWeightKg'))
  const paceKey = String(fd.get('paceKey') ?? '')
  const activity = toNumberOrNull(fd.get('activityFactor'))
  if (!isYmd(startDate)) return fail('開始日を入れてください')
  if (target == null || target < 20 || target > 250) return fail('目標体重は20〜250kgで入れてください')
  if (!settings.paces.some((p) => p.key === paceKey)) return fail('減量ペースを選んでください')
  if (activity == null || activity < 1 || activity > 2.5) return fail('活動係数を選んでください')

  const at = await prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(startDate) }, weightKg: { not: null } }, orderBy: { date: 'desc' } })
  const fat = await prisma.bodyLog.findFirst({ where: { clientId, date: { lte: toDbDate(startDate) }, bodyFatPct: { not: null } }, orderBy: { date: 'desc' } })
  await prisma.goal.create({
    data: {
      clientId,
      startDate: toDbDate(startDate),
      startWeightKg: at?.weightKg ?? null,
      startBodyFatPct: fat?.bodyFatPct ?? null,
      targetWeightKg: target,
      paceKey,
      activityFactor: activity,
      note: textOrNull(fd.get('note'))?.slice(0, 200) ?? null,
      createdById: user.id,
    },
  })
  revalidatePath(`/clients/${clientId}`, 'layout')
  revalidatePath('/clients')
  return { ok: true, message: '目標を保存しました。概要の計算と予測に反映されます', at: Date.now() }
}

export async function deleteGoalAction(clientId: string, goalId: string) {
  await requireUser()
  await prisma.goal.deleteMany({ where: { id: goalId, clientId } })
  revalidatePath(`/clients/${clientId}`, 'layout')
  revalidatePath('/clients')
}
