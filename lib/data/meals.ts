import { prisma } from '@/lib/prisma'
import { fromDbDate, toDbDate, type Ymd } from '@/lib/dates'

export type MealWeek = Record<Ymd, Record<string, string>>

export async function getMealMemos(clientId: string, from: Ymd, to: Ymd): Promise<MealWeek> {
  const rows = await prisma.mealMemo.findMany({ where: { clientId, date: { gte: toDbDate(from), lte: toDbDate(to) } } })
  const out: MealWeek = {}
  for (const r of rows) {
    const d = fromDbDate(r.date)
    ;(out[d] ??= {})[r.slot] = r.text
  }
  return out
}
