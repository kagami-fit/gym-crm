'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'
import { alertSettingsSchema } from '@/lib/alerts/settings'
import type { ActionState } from '@/components/SubmitButton'

const LABELS: Record<string, string> = { plateau: '体重の停滞', noProgress: '伸びていない種目', dietFlat: '食事の変化なし', noVisit: '来店があいている', behindPace: '予定ペースより遅れ', talk: '気になる会話メモ' }

/** お知らせの条件と段階を保存（オーナーのみ） */
export async function saveAlertSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner()
  const n = (k: string) => Number(fd.get(k))
  const on = (k: string) => fd.get(k) === 'on'
  const three = (k: string) => [n(`${k}.0`), n(`${k}.1`), n(`${k}.2`)]
  const raw = {
    plateau: { enabled: on('plateau.enabled'), days: three('plateau.days') },
    noProgress: { enabled: on('noProgress.enabled'), counts: three('noProgress.counts'), skipBodyweight: on('noProgress.skipBodyweight') },
    dietFlat: { enabled: on('dietFlat.enabled'), weeks: n('dietFlat.weeks'), pct: n('dietFlat.pct') },
    noVisit: { enabled: on('noVisit.enabled'), days: three('noVisit.days') },
    behindPace: { enabled: on('behindPace.enabled'), kg: three('behindPace.kg') },
    talk: { enabled: on('talk.enabled'), days: n('talk.days') },
  }
  const r = alertSettingsSchema.safeParse(raw)
  if (!r.success) {
    const i = r.error.issues[0]
    return { ok: false, message: `${LABELS[String(i?.path[0])] ?? ''}：${i?.message ?? '入力内容を確認してください'}`, at: Date.now() }
  }
  const value = r.data as unknown as Prisma.InputJsonValue
  await prisma.appSetting.upsert({ where: { key: 'alerts' }, update: { value }, create: { key: 'alerts', value } })
  revalidatePath('/', 'layout')
  return { ok: true, message: 'お知らせの条件を保存しました', at: Date.now() }
}
