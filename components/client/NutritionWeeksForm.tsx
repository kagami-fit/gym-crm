'use client'

import { useActionState } from 'react'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import type { NutritionRow } from '@/lib/data/nutrition'
import { addDays, md, type Ymd } from '@/lib/dates'
import { int } from '@/lib/format'
import { cn } from '@/lib/utils'

const FIELDS = [
  { key: 'targetKcal', label: '設定カロリー', unit: 'kcal' },
  { key: 'avgKcal', label: '平均カロリー', unit: 'kcal' },
  { key: 'proteinG', label: 'P', unit: 'g' },
  { key: 'fatG', label: 'F', unit: 'g' },
  { key: 'carbsG', label: 'C', unit: 'g' },
] as const

const cell = 'h-11 w-full min-w-0 rounded-lg border border-line-2 bg-white px-2 text-right text-base outline-none focus:border-brand-deep focus:ring-2 focus:ring-brand-soft'

/**
 * 週ごとの食事の数字（食事アプリの週平均をヒアリングで聞いて入れる）。新しい週が上。
 * 体重が停滞していて、この数字が何週間もほぼ同じだと「食事の変化なし」のお知らせが出る。
 */
export function NutritionWeeksForm({ action, weeks, rows, thisWeek }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; weeks: Ymd[]; rows: Record<Ymd, NutritionRow>; thisWeek: Ymd }) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="weeks" value={weeks.join(',')} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-dark text-xs text-white">
            <tr>
              <th className="px-3 py-2 text-left font-bold">週</th>
              {FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2 text-right font-bold">
                  {f.label}
                  <span className="ml-0.5 font-normal opacity-80">（{f.unit}）</span>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-bold">設定との差</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {weeks.map((w) => {
              const r = rows[w]
              const diff = r?.avgKcal != null && r?.targetKcal != null ? r.avgKcal - r.targetKcal : null
              return (
                <tr key={w} className={cn(w === thisWeek && 'bg-brand-soft/40')}>
                  <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-bold">
                    <span className="num">
                      {md(w)}〜{md(addDays(w, 6))}
                    </span>
                    {w === thisWeek && <span className="ml-1.5 text-xs text-brand-ink">今週</span>}
                  </th>
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-1.5 py-1.5">
                      <input name={`n_${w}_${f.key}`} defaultValue={r?.[f.key] ?? ''} inputMode="decimal" className={cell} aria-label={`${md(w)}の週の${f.label}`} />
                    </td>
                  ))}
                  <td className={cn('num whitespace-nowrap px-3 py-1.5 text-right font-bold', diff == null ? 'text-ink-3' : diff > 0 ? 'text-warn' : 'text-ok')}>
                    {diff == null ? '—' : `${diff > 0 ? '+' : ''}${int(diff)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="保存しています">食事の数字を保存</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
