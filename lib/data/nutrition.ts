import { prisma } from '@/lib/prisma'
import { addDays, fromDbDate, toDbDate, weekStartOf, type Ymd } from '@/lib/dates'

/** 週ごとの食事の数字（ヒアリングで手入力） */
export type NutritionRow = { weekStart: Ymd; targetKcal: number | null; avgKcal: number | null; proteinG: number | null; fatG: number | null; carbsG: number | null }

/** 基準日の週から、さかのぼって n 週分（新しい週が先） */
export function recentWeeks(base: Ymd, n: number): Ymd[] {
  const w = weekStartOf(base)
  return Array.from({ length: n }, (_, i) => addDays(w, -7 * i))
}

export async function getNutritionWeeks(clientId: string, weeks: Ymd[]): Promise<Record<Ymd, NutritionRow>> {
  if (!weeks.length) return {}
  const rows = await prisma.nutritionWeek.findMany({ where: { clientId, weekStart: { in: weeks.map(toDbDate) } } })
  const out: Record<Ymd, NutritionRow> = {}
  for (const r of rows) {
    const w = fromDbDate(r.weekStart)
    out[w] = { weekStart: w, targetKcal: r.targetKcal, avgKcal: r.avgKcal, proteinG: r.proteinG, fatG: r.fatG, carbsG: r.carbsG }
  }
  return out
}
