'use client'

import { useActionState } from 'react'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { inputClass } from '@/components/ui'
import { monthJa } from '@/lib/dates'
import type { ThemeRow } from '@/lib/steps'
import { cn } from '@/lib/utils'

/**
 * 月ごとのテーマとトレーニングテーマ（新しい月が上）。今月の分はトレーニングの帯の「今月」に出る。
 * 月の左には、その月にかかっている期を色つきで出す。
 */
export function ThemesForm({
  action,
  months,
  themes,
  phasesByMonth,
  current,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>
  months: string[]
  themes: Record<string, ThemeRow>
  phasesByMonth: Record<string, Array<{ name: string; color: string }>>
  current: string
}) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="months" value={months.join(',')} />
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {months.map((m) => {
          const t = themes[m]
          return (
            <li key={m} className={cn('grid gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)] md:items-center', m === current && 'bg-brand-soft/40')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:block">
                <p className="text-[15px] font-black">
                  {monthJa(m)}
                  {m === current && <span className="ml-1.5 text-xs font-bold text-brand-ink">今月</span>}
                  {m > current && <span className="ml-1.5 text-xs font-bold text-ink-3">来月</span>}
                </p>
                <div className="flex flex-wrap gap-1 md:mt-1">
                  {(phasesByMonth[m] ?? []).map((p) => (
                    <span key={p.name} className="inline-flex items-center gap-1 rounded-full px-2 text-[11px] font-bold leading-5 text-ink" style={{ background: `${p.color}24` }}>
                      <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
              <label className="block min-w-0">
                <span className="text-xs font-bold text-ink-2">テーマ</span>
                <input name={`t_${m}_theme`} defaultValue={t?.theme ?? ''} maxLength={100} placeholder="例：睡眠と呼吸を整える" className={cn(inputClass, 'mt-1')} />
              </label>
              <label className="block min-w-0">
                <span className="text-xs font-bold text-ink-2">トレーニングテーマ</span>
                <input name={`t_${m}_training`} defaultValue={t?.trainingTheme ?? ''} maxLength={100} placeholder="例：股関節を動かせるようにする" className={cn(inputClass, 'mt-1')} />
              </label>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="保存しています">テーマを保存</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
