'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'
import { getCalcSettings, getPurposes } from '@/lib/data/settings'
import { planPurposeChanges } from '@/lib/purposes'
import type { ActionState } from '@/components/SubmitButton'

const done = (message: string, ok = true): ActionState => ({ ok, message, at: Date.now() })
const dup = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

export async function addExerciseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner()
  const settings = await getCalcSettings()
  const bodyPart = String(fd.get('bodyPart') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 60)
  const purpose = await purposeOf(fd)
  if (!settings.bodyParts.includes(bodyPart)) return done('部位を選んでください', false)
  if (!name) return done('種目名を入れてください', false)
  const max = await prisma.exercise.aggregate({ where: { bodyPart }, _max: { sortOrder: true } })
  try {
    await prisma.exercise.create({ data: { bodyPart, name, purpose, sortOrder: (max._max.sortOrder ?? 0) + 1 } })
  } catch (e) {
    if (dup(e)) return done(`「${name}」はすでに${bodyPart}にあります`, false)
    throw e
  }
  revalidatePath('/settings/exercises')
  return done(`「${name}」を${bodyPart}に追加しました`)
}

export async function updateExerciseAction(id: string, fd: FormData) {
  await requireOwner()
  const name = String(fd.get('name') ?? '').trim().slice(0, 60)
  const active = fd.get('active') === 'on'
  const purpose = await purposeOf(fd)
  if (!name) return
  try {
    await prisma.exercise.update({ where: { id }, data: { name, active, purpose } })
  } catch (e) {
    if (!dup(e)) throw e
  }
  revalidatePath('/settings/exercises')
}

/** いつもの目的（選択肢にないものは入れない） */
async function purposeOf(fd: FormData): Promise<string | null> {
  const v = String(fd.get('purpose') ?? '').trim()
  return v && (await getPurposes()).includes(v) ? v : null
}

/**
 * 目的の選択肢を保存する。名前を変えたものは、これまでの記録と種目マスタの目的も新しい名前にする
 * （入れ替え〈AとBの名前を交換〉でも混ざらないよう、いったん仮の名前にしてから付け直す）。
 * 消したものは種目マスタの「いつもの目的」から外す（記録の目的は残す）。
 */
export async function savePurposesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireOwner()
  let raw: unknown
  try {
    raw = JSON.parse(String(fd.get('payload') ?? '[]'))
  } catch {
    return done('送信内容を読み取れませんでした', false)
  }
  const parsed = z.array(z.object({ label: z.string().max(100), from: z.string().max(100).nullable() })).max(100).safeParse(raw)
  if (!parsed.success) return done('送信内容を読み取れませんでした', false)
  const plan = planPurposeChanges(await getPurposes(), parsed.data)
  if (!plan.ok) return done(plan.message, false)
  const tmp = (i: number) => `__rename_${Date.now()}_${i}__`
  const tmps = plan.renames.map((_, i) => tmp(i))
  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { key: 'purposes' }, update: { value: plan.options, updatedById: user.id }, create: { key: 'purposes', value: plan.options, updatedById: user.id } }),
    ...plan.renames.flatMap(([from], i) => [
      prisma.exercise.updateMany({ where: { purpose: from }, data: { purpose: tmps[i] } }),
      prisma.trainingSet.updateMany({ where: { purpose: from }, data: { purpose: tmps[i] } }),
    ]),
    ...plan.renames.flatMap(([, to], i) => [
      prisma.exercise.updateMany({ where: { purpose: tmps[i] }, data: { purpose: to } }),
      prisma.trainingSet.updateMany({ where: { purpose: tmps[i] }, data: { purpose: to } }),
    ]),
    ...(plan.removed.length ? [prisma.exercise.updateMany({ where: { purpose: { in: plan.removed } }, data: { purpose: null } })] : []),
  ])
  revalidatePath('/', 'layout')
  return done(`目的の選択肢を保存しました${plan.renames.length ? `（名前を変えた${plan.renames.length}件は、これまでの記録と種目マスタにも反映）` : ''}`)
}

export async function moveExerciseAction(id: string, dir: -1 | 1) {
  await requireOwner()
  const ex = await prisma.exercise.findUnique({ where: { id } })
  if (!ex) return
  const list = await prisma.exercise.findMany({ where: { bodyPart: ex.bodyPart }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  const i = list.findIndex((x) => x.id === id)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  await prisma.$transaction(list.map((x, k) => prisma.exercise.update({ where: { id: x.id }, data: { sortOrder: k } })))
  revalidatePath('/settings/exercises')
}

export async function deleteExerciseAction(id: string) {
  await requireOwner()
  // 過去のトレーニング記録は種目名で持っているので、マスタから消しても記録は残る
  await prisma.exercise.deleteMany({ where: { id } })
  revalidatePath('/settings/exercises')
}
