'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'
import { MEAL_SLOTS } from '@/lib/labels'
import type { ActionState } from '@/components/SubmitButton'

/** 7日×朝昼夕間食メモ をまとめて保存（空欄は消す） */
export async function saveMealsAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser()
  const dates = String(fd.get('dates') ?? '').split(',').filter(isYmd).slice(0, 14)
  if (!dates.length) return { ok: false, message: '日付が正しくありません', at: Date.now() }
  for (const d of dates) {
    for (const { key } of MEAL_SLOTS) {
      const text = String(fd.get(`m_${d}_${key}`) ?? '').trim().slice(0, 1000)
      const where = { clientId_date_slot: { clientId, date: toDbDate(d), slot: key } }
      if (!text) await prisma.mealMemo.deleteMany({ where: { clientId, date: toDbDate(d), slot: key } })
      else await prisma.mealMemo.upsert({ where, update: { text }, create: { clientId, date: toDbDate(d), slot: key, text } })
    }
  }
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true, message: '食事メモを保存しました', at: Date.now() }
}
