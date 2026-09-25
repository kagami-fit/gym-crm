// 日付は「YYYY-MM-DD」の文字列（日本時間の暦日）で扱う。DBの @db.Date とは UTC 0時の Date で受け渡す。

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export type Ymd = string

export function todayYmd(): Ymd {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function isYmd(v: unknown): v is Ymd {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export function toDbDate(ymd: Ymd): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

export function fromDbDate(d: Date): Ymd {
  return d.toISOString().slice(0, 10)
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const d = toDbDate(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return fromDbDate(d)
}

/** b − a の日数 */
export function diffDays(a: Ymd, b: Ymd): number {
  return Math.round((toDbDate(b).getTime() - toDbDate(a).getTime()) / 86_400_000)
}

export function monthKey(ymd: Ymd): string {
  return ymd.slice(0, 7)
}

/** 'YYYY-MM' に n ヶ月足す */
export function addMonthsKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function weekday(ymd: Ymd): string {
  return WEEKDAYS[toDbDate(ymd).getUTCDay()]
}

/** 9/24 */
export function md(ymd: Ymd): string {
  const [, m, d] = ymd.split('-').map(Number)
  return `${m}/${d}`
}

/** 9/24(水) */
export function mdw(ymd: Ymd): string {
  return `${md(ymd)}(${weekday(ymd)})`
}

/** 2026年9月24日(水) */
export function ymdJa(ymd: Ymd, withWeekday = true): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${y}年${m}月${d}日${withWeekday ? `(${weekday(ymd)})` : ''}`
}

/** '2026-09' → 2026年9月 */
export function monthJa(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${y}年${m}月`
}

/** '2026-09' → 9月 */
export function monthShort(key: string): string {
  return `${Number(key.split('-')[1])}月`
}

export function ageAt(birth: Ymd | null | undefined, base: Ymd): number | null {
  if (!birth) return null
  const [by, bm, bd] = birth.split('-').map(Number)
  const [y, m, d] = base.split('-').map(Number)
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age -= 1
  return age >= 0 ? age : null
}

/** base を最終日とする n 日分（古い順） */
export function daysEndingAt(base: Ymd, n: number): Ymd[] {
  return Array.from({ length: n }, (_, i) => addDays(base, i - (n - 1)))
}
