'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { md, todayYmd, weekday } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** 基準日（来店日）の切り替え。?date= をすべてのタブで共有する */
export function BaseDateBar({ visits }: { visits: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const today = todayYmd()
  const current = params.get('date') ?? today

  function go(date: string) {
    const next = new URLSearchParams()
    if (date !== today) next.set('date', date)
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const chips = [today, ...visits.filter((v) => v !== today)].slice(0, 7)

  return (
    <div className="rounded-xl border border-line bg-soft p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <CalendarDays className="size-4 text-brand-ink" aria-hidden />
          基準日（来店日）
          <input
            type="date"
            value={current}
            max="2100-12-31"
            onChange={(e) => e.target.value && go(e.target.value)}
            className="num min-h-10 rounded-lg border border-line-2 bg-white px-3 py-1.5 text-base font-semibold text-ink"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="来店日から選ぶ">
        {chips.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => go(d)}
            className={cn(
              'min-h-10 rounded-full border px-3.5 py-2 text-sm font-bold',
              d === current ? 'border-brand-deep bg-brand text-ink' : 'border-line-2 bg-white text-ink-2 hover:bg-brand-soft',
            )}
            aria-pressed={d === current}
          >
            {d === today ? '今日' : <span className="num">{md(d)}</span>}
            {d !== today && <span className="ml-0.5">({weekday(d)})</span>}
            {visits.includes(d) && d === today && <span className="ml-1 opacity-80">来店</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
