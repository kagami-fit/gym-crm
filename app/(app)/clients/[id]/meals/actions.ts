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

const NUTRITION_FIELDS = ['targetKcal', 'avgKcal', 'proteinG', 'fatG', 'carbsG'] as const

/** 週ごとの食事の数字（設定カロリー・平均カロリー・PFC）をまとめて保存（全部空の週は消す） */
export async function saveNutritionAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const weeks = String(fd.get('weeks') ?? '').split(',').filter(isYmd).slice(0, 12)
  if (!weeks.length) return { ok: false, message: '週が正しくありません', at: Date.now() }
  for (const w of weeks) {
    const vals: Record<string, number | null> = {}
    for (const f of NUTRITION_FIELDS) {
      const raw = String(fd.get(`n_${w}_${f}`) ?? '').trim()
      if (!raw) {
        vals[f] = null
        continue
      }
      const v = Number(raw)
      const max = f.endsWith('Kcal') ? 10000 : 1000
      if (!Number.isFinite(v) || v < 0 || v > max) return { ok: false, message: `${w.slice(5).replace('-', '/')}の週：数字を確認してください`, at: Date.now() }
      vals[f] = Math.round(v * 10) / 10
    }
    const where = { clientId_weekStart: { clientId, weekStart: toDbDate(w) } }
    if (NUTRITION_FIELDS.every((f) => vals[f] == null)) await prisma.nutritionWeek.deleteMany({ where: { clientId, weekStart: toDbDate(w) } })
    else await prisma.nutritionWeek.upsert({ where, update: { ...vals, updatedById: user.id }, create: { clientId, weekStart: toDbDate(w), ...vals, updatedById: user.id } })
  }
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true, message: '食事の数字を保存しました', at: Date.now() }
}
