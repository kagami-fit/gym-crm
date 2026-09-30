import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { normalizeSettings, type CalcSettings } from '@/lib/calc/settings'
import { normalizePurposes } from '@/lib/purposes'

/** 計算設定（1リクエストの中では1回だけ読む） */
export const getCalcSettings = cache(async (): Promise<CalcSettings> => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'calc' } })
  return normalizeSettings(row?.value)
})

/** 種目の目的の選択肢（1リクエストの中では1回だけ読む） */
export const getPurposes = cache(async (): Promise<string[]> => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'purposes' } })
  return normalizePurposes(row?.value)
})
