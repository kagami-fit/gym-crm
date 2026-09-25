import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { normalizeSettings, type CalcSettings } from '@/lib/calc/settings'

/** 計算設定（1リクエストの中では1回だけ読む） */
export const getCalcSettings = cache(async (): Promise<CalcSettings> => {
  const row = await prisma.appSetting.findUnique({ where: { key: 'calc' } })
  return normalizeSettings(row?.value)
})
