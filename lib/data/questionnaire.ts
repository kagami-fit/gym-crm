import { prisma } from '@/lib/prisma'
import { fromDbDate, type Ymd } from '@/lib/dates'
import { asAnswers, type QAnswers } from '@/lib/questionnaire'

export async function getQuestionnaire(clientId: string): Promise<{ answeredOn: Ymd | null; answers: QAnswers; updatedAt: Date } | null> {
  const q = await prisma.questionnaire.findUnique({ where: { clientId } })
  if (!q) return null
  return { answeredOn: q.answeredOn ? fromDbDate(q.answeredOn) : null, answers: asAnswers(q.answers), updatedAt: q.updatedAt }
}
