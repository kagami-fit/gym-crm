'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireOwner, requireUser } from '@/lib/session'
import { parseClientForm, toClientData } from '@/lib/client-form'
import { isYmd, todayYmd, toDbDate } from '@/lib/dates'
import { toNumberOrNull, textOrNull } from '@/lib/format'
import { getCalcSettings } from '@/lib/data/settings'
import type { ActionState } from '@/components/SubmitButton'

function uniqueError(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'この会員番号はすでに使われています'
  return null
}

async function validTrainer(id: string | null): Promise<string | null> {
  if (!id) return null
  return (await prisma.user.findUnique({ where: { id }, select: { id: true } }))?.id ?? null
}

export async function createClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const parsed = parseClientForm(fd)
  if (!parsed.ok) return { ok: false, message: parsed.message, at: Date.now() }
  const settings = await getCalcSettings()

  // 最初の測定と目標（任意）
  const measuredOn = textOrNull(fd.get('measuredOn')) ?? todayYmd()
  if (!isYmd(measuredOn)) return { ok: false, message: '測定日の形式が正しくありません', at: Date.now() }
  const weight = toNumberOrNull(fd.get('weightKg'))
  const bodyFat = toNumberOrNull(fd.get('bodyFatPct'))
  const target = toNumberOrNull(fd.get('targetWeightKg'))
  const paceKey = String(fd.get('paceKey') ?? '')
  const activity = toNumberOrNull(fd.get('activityFactor'))
  if (weight != null && (weight < 20 || weight > 250)) return { ok: false, message: '体重は20〜250kgで入れてください', at: Date.now() }
  if (bodyFat != null && (bodyFat < 2 || bodyFat > 70)) return { ok: false, message: '体脂肪率は2〜70%で入れてください', at: Date.now() }
  if (target != null && (target < 20 || target > 250)) return { ok: false, message: '目標体重は20〜250kgで入れてください', at: Date.now() }

  let id: string
  try {
    const data = toClientData(parsed.data)
    const c = await prisma.client.create({
      data: { ...data, trainerId: (await validTrainer(data.trainerId)) ?? user.id },
    })
    id = c.id
    if (weight != null || bodyFat != null) {
      await prisma.bodyLog.create({ data: { clientId: id, date: toDbDate(measuredOn), weightKg: weight, bodyFatPct: bodyFat } })
    }
    if (target != null) {
      await prisma.goal.create({
        data: {
          clientId: id,
          startDate: toDbDate(measuredOn),
          startWeightKg: weight,
          startBodyFatPct: bodyFat,
          targetWeightKg: target,
          paceKey: settings.paces.some((p) => p.key === paceKey) ? paceKey : settings.paces[0].key,
          activityFactor: activity ?? settings.activityFactors[0].value,
          note: '登録時に設定',
          createdById: user.id,
        },
      })
    }
  } catch (e) {
    const msg = uniqueError(e)
    if (msg) return { ok: false, message: msg, at: Date.now() }
    throw e
  }
  revalidatePath('/clients')
  redirect(`/clients/${id}`)
}

export async function updateClientAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser()
  const parsed = parseClientForm(fd)
  if (!parsed.ok) return { ok: false, message: parsed.message, at: Date.now() }
  try {
    const data = toClientData(parsed.data)
    await prisma.client.update({ where: { id: clientId }, data: { ...data, trainerId: await validTrainer(data.trainerId) } })
  } catch (e) {
    const msg = uniqueError(e)
    if (msg) return { ok: false, message: msg, at: Date.now() }
    throw e
  }
  revalidatePath(`/clients/${clientId}`, 'layout')
  revalidatePath('/clients')
  return { ok: true, message: '保存しました', at: Date.now() }
}

export async function deleteClientAction(clientId: string) {
  await requireOwner()
  await prisma.client.delete({ where: { id: clientId } })
  revalidatePath('/clients')
  redirect('/clients?deleted=1')
}
