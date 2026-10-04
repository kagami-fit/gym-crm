import { prisma } from '@/lib/prisma'
import { fromDbDate } from '@/lib/dates'
import { resolvePhases, type PhaseRow, type ThemeRow } from '@/lib/steps'

// 指導計画のフェーズと月ごとのテーマの読み込み。計算は lib/steps.ts

export { phaseAt, type PhaseRow, type ThemeRow } from '@/lib/steps'

export async function getPhases(clientId: string): Promise<PhaseRow[]> {
  const rows = await prisma.clientPhase.findMany({ where: { clientId }, orderBy: { startDate: 'asc' } })
  return resolvePhases(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      start: fromDbDate(r.startDate),
      end: r.endDate ? fromDbDate(r.endDate) : null,
      note: r.note,
      reviewDate: r.reviewDate ? fromDbDate(r.reviewDate) : null,
      visitFrequency: r.visitFrequency,
    })),
  )
}

export async function getThemes(clientId: string): Promise<Record<string, ThemeRow>> {
  const rows = await prisma.monthlyTheme.findMany({ where: { clientId } })
  return Object.fromEntries(rows.map((r) => [r.month, { month: r.month, theme: r.theme, trainingTheme: r.trainingTheme }]))
}
