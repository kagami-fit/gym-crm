'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/session'
import { isYmd, toDbDate } from '@/lib/dates'
import { parseAnswers } from '@/lib/questionnaire'
import type { ActionState } from '@/components/SubmitButton'

export async function saveQuestionnaireAction(clientId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser()
  const answeredOn = String(fd.get('answeredOn') ?? '')
  const answers = parseAnswers(fd) as Prisma.InputJsonValue
  const data = { answeredOn: isYmd(answeredOn) ? toDbDate(answeredOn) : null, answers, updatedById: user.id }
  await prisma.questionnaire.upsert({ where: { clientId }, update: data, create: { clientId, ...data } })
  revalidatePath(`/clients/${clientId}`, 'layout')
  return { ok: true, message: '問診票を保存しました', at: Date.now() }
}
