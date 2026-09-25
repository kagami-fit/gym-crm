'use server'

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireOwner } from '@/lib/session'
import { getCalcSettings } from '@/lib/data/settings'
import type { ActionState } from '@/components/SubmitButton'

const done = (message: string, ok = true): ActionState => ({ ok, message, at: Date.now() })
const dup = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

export async function addExerciseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireOwner()
  const settings = await getCalcSettings()
  const bodyPart = String(fd.get('bodyPart') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 60)
  if (!settings.bodyParts.includes(bodyPart)) return done('部位を選んでください', false)
  if (!name) return done('種目名を入れてください', false)
  const max = await prisma.exercise.aggregate({ where: { bodyPart }, _max: { sortOrder: true } })
  try {
    await prisma.exercise.create({ data: { bodyPart, name, sortOrder: (max._max.sortOrder ?? 0) + 1 } })
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
  if (!name) return
  try {
    await prisma.exercise.update({ where: { id }, data: { name, active } })
  } catch (e) {
    if (!dup(e)) throw e
  }
  revalidatePath('/settings/exercises')
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
