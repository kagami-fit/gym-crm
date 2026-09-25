import { daysEndingAt, mdw, todayYmd } from '@/lib/dates'
import { MEAL_SLOTS } from '@/lib/labels'
import type { MealWeek } from '@/lib/data/meals'
import { cn } from '@/lib/utils'

/** 直近7日×朝・昼・夕・間食・メモ（参考シートの「食事ログ」の並び） */
export function MealWeekView({ base, memos }: { base: string; memos: MealWeek }) {
  const days = daysEndingAt(base, 7)
  const today = todayYmd()
  const empty = days.every((d) => !memos[d] || Object.keys(memos[d]).length === 0)
  if (empty) return <p className="rounded-xl bg-soft py-8 text-center text-sm text-ink-3">この7日間の食事メモはありません</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[860px] table-fixed text-xs">
        <thead>
          <tr className="bg-tint text-dark">
            <th className="w-16 px-2 py-2 text-left font-bold" />
            {days.map((d) => (
              <th key={d} className={cn('px-2 py-2 text-left font-bold', d === base && 'bg-dark text-white')}>
                <span className="num">{mdw(d)}</span>
                {d === today && <span className="ml-1 font-normal opacity-80">今日</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {MEAL_SLOTS.map((s) => (
            <tr key={s.key} className="align-top">
              <th className="bg-soft px-2 py-2 text-left font-bold text-ink-2">{s.label}</th>
              {days.map((d) => (
                <td key={d} className={cn('whitespace-pre-wrap break-words px-2 py-2 leading-relaxed text-ink', d === base && 'bg-brand-soft/50')}>
                  {memos[d]?.[s.key] ?? <span className="text-line-2">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
