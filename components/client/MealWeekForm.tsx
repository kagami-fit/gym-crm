'use client'

import { useActionState } from 'react'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { mdw, todayYmd } from '@/lib/dates'
import { MEAL_SLOTS } from '@/lib/labels'
import { cn } from '@/lib/utils'

/**
 * 7日分の食事メモ。パソコンの広い画面では表（1日1行）、iPad・スマホでは1日ごとのカードで入力する。
 * 入力欄は1組だけ（見た目だけを切り替える）なので、どちらで入力しても同じように保存される。
 */
export function MealWeekForm({ action, days, memos }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; days: string[]; memos: Record<string, Record<string, string>> }) {
  const [state, formAction] = useActionState(action, null)
  const today = todayYmd()
  const cols = 'xl:grid xl:grid-cols-[7rem_repeat(5,minmax(0,1fr))] xl:gap-0'
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="dates" value={days.join(',')} />
      <div className="xl:overflow-hidden xl:rounded-xl xl:border xl:border-line">
        <div className={cn('hidden bg-dark text-xs font-bold text-white', cols)} aria-hidden>
          <span className="px-3 py-2">日付</span>
          {MEAL_SLOTS.map((s) => (
            <span key={s.key} className="px-2 py-2">
              {s.label}
            </span>
          ))}
        </div>
        <div className="space-y-3 xl:space-y-0 xl:divide-y xl:divide-line">
          {[...days].reverse().map((d) => (
            <section
              key={d}
              className={cn('rounded-2xl border border-line bg-white p-3 xl:rounded-none xl:border-0 xl:p-0', cols, d === today && 'border-brand-deep bg-brand-soft/30 xl:bg-brand-soft/40')}
              aria-label={`${mdw(d)}の食事`}
            >
              <p className="mb-2 font-black xl:mb-0 xl:px-3 xl:py-2.5 xl:text-sm">
                <span className="num">{mdw(d)}</span>
                {d === today && <span className="ml-2 text-xs font-bold text-brand-ink xl:ml-0 xl:block">今日</span>}
              </p>
              <div className="grid gap-2 md:grid-cols-2 xl:contents">
                {MEAL_SLOTS.map((s) => (
                  <label key={s.key} className={cn('block xl:px-1.5 xl:py-1.5', s.key === 'note' && 'md:col-span-2 xl:col-span-1')}>
                    <span className="mb-1 block text-xs font-bold text-ink-3 xl:sr-only">{s.label}</span>
                    <textarea
                      name={`m_${d}_${s.key}`}
                      defaultValue={memos[d]?.[s.key] ?? ''}
                      rows={2}
                      maxLength={1000}
                      className="block min-h-11 w-full resize-y rounded-xl border border-line-2 bg-white px-3 py-2 text-base leading-relaxed outline-none placeholder:text-line-2 focus:border-brand-deep focus:ring-2 focus:ring-brand-soft xl:rounded-lg xl:px-2 xl:py-1.5 xl:text-sm"
                      placeholder={s.key === 'note' ? '水分・体調など' : '—'}
                      aria-label={`${mdw(d)}の${s.label}`}
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <SubmitButton pendingText="保存しています">7日分を保存</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
