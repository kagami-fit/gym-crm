import { isYmd, todayYmd, type Ymd } from '@/lib/dates'

/** 顧客ページの基準日（来店日）。?date= がなければ今日 */
export function resolveBaseDate(v: string | string[] | undefined): Ymd {
  const s = Array.isArray(v) ? v[0] : v
  return isYmd(s) ? s : todayYmd()
}
