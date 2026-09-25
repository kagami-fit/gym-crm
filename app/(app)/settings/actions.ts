'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'
import { calcSettingsSchema } from '@/lib/calc/settings'
import { getCalcSettings } from '@/lib/data/settings'
import type { ActionState } from '@/components/SubmitButton'

export async function saveSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOwner()
  let raw: unknown
  try {
    raw = JSON.parse(String(fd.get('payload') ?? '{}'))
  } catch {
    return { ok: false, message: '送信内容を読み取れませんでした', at: Date.now() }
  }
  const r = calcSettingsSchema.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    const where = i?.path[0] === 'paces' ? '減量ペース：' : i?.path[0] === 'activityFactors' ? '活動係数：' : ''
    return { ok: false, message: `${where}${i?.message ?? '入力内容を確認してください'}`, at: Date.now() }
  }
  const next = r.data
  const names = next.paces.map((p) => p.name)
  if (new Set(names).size !== names.length) return { ok: false, message: '減量ペースの名前が重複しています', at: Date.now() }
  const values = next.activityFactors.map((a) => a.value)
  if (new Set(values).size !== values.length) return { ok: false, message: '活動係数の値が重複しています', at: Date.now() }

  // 目標で使われている減量ペースは消せない（計算が変わってしまうため）
  const current = await getCalcSettings()
  const removed = current.paces.filter((p) => !next.paces.some((n) => n.key === p.key))
  for (const p of removed) {
    const used = await prisma.goal.count({ where: { paceKey: p.key } })
    if (used > 0) return { ok: false, message: `「${p.name}」は ${used}件の目標で使われているため削除できません（名前や%は変更できます）`, at: Date.now() }
  }

  await prisma.appSetting.upsert({
    where: { key: 'calc' },
    update: { value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
    create: { key: 'calc', value: next as unknown as Prisma.InputJsonValue, updatedById: user.id },
  })
  revalidatePath('/', 'layout')
  return { ok: true, message: '保存しました。すべての顧客の計算に反映されます', at: Date.now() }
}
