'use client'

import { useActionState } from 'react'
import { Trash2 } from 'lucide-react'
import { Field, inputClass, numInputClass, buttonClass } from '@/components/ui'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { mdw, todayYmd } from '@/lib/dates'
import { signed } from '@/lib/format'
import { cn } from '@/lib/utils'

type Day = { date: string; weightKg: number | null; bodyFatPct: number | null; note: string | null }

/** 7日分の体重・体脂肪率をまとめて入力（ヒアリングで聞いた数値を一度に） */
export function BodyWeekForm({ action, days, prevWeight }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; days: Day[]; prevWeight: number | null }) {
  const [state, formAction] = useActionState(action, null)
  const today = todayYmd()
  // 前回比：保存済みの体重で、直前に記録がある日との差
  const diffs = days.reduce<{ last: number | null; out: Array<number | null> }>(
    (acc, d) => ({ last: d.weightKg ?? acc.last, out: [...acc.out, d.weightKg != null && acc.last != null ? d.weightKg - acc.last : null] }),
    { last: prevWeight, out: [] },
  ).out
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="dates" value={days.map((d) => d.date).join(',')} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-dark text-left text-xs text-white">
            <tr>
              <th className="px-3 py-2 font-bold">日付</th>
              <th className="w-36 px-3 py-2 text-right font-bold">体重（kg）</th>
              <th className="w-24 px-3 py-2 text-right font-bold">前回比</th>
              <th className="w-36 px-3 py-2 text-right font-bold">体脂肪率（%）</th>
              <th className="px-3 py-2 font-bold">メモ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days.map((d, i) => {
              const diff = diffs[i]
              return (
                <tr key={d.date} className={cn(d.date === today && 'bg-brand-soft/50')}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold">
                    <span className="num">{mdw(d.date)}</span>
                    {d.date === today && <span className="ml-2 text-xs text-brand-ink">今日</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    <input name={`w_${d.date}`} inputMode="decimal" defaultValue={d.weightKg ?? ''} className={numInputClass} aria-label={`${mdw(d.date)}の体重`} />
                  </td>
                  <td className="num tnum px-3 py-2 text-right text-xs text-ink-3">{diff != null ? `${signed(diff)}` : ''}</td>
                  <td className="px-3 py-1.5">
                    <input name={`f_${d.date}`} inputMode="decimal" defaultValue={d.bodyFatPct ?? ''} className={numInputClass} aria-label={`${mdw(d.date)}の体脂肪率`} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input name={`n_${d.date}`} defaultValue={d.note ?? ''} maxLength={200} className={inputClass} placeholder="例：朝・起床後" aria-label={`${mdw(d.date)}のメモ`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="保存しています">7日分を保存</SubmitButton>
        <FormMessage state={state} />
        <p className="text-xs text-ink-3">空欄の日は記録なしになります。前回比は保存済みの値で計算しています。</p>
      </div>
    </form>
  )
}

type PaceOpt = { key: string; name: string; percentPerMonth: number; note: string }
type ActOpt = { value: number; label: string }

export function GoalForm({
  action,
  paces,
  activityFactors,
  defaults,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>
  paces: PaceOpt[]
  activityFactors: ActOpt[]
  defaults: { startDate: string; targetWeightKg: number | null; paceKey: string | null; activityFactor: number | null }
}) {
  const [state, formAction] = useActionState(action, null)
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="開始日" hint="この日から新しい目標で計算します">
          <input type="date" name="startDate" required defaultValue={defaults.startDate} className={inputClass} />
        </Field>
        <Field label="目標体重（kg）">
          <input name="targetWeightKg" required inputMode="decimal" defaultValue={defaults.targetWeightKg ?? ''} className={numInputClass} />
        </Field>
        <Field label="減量ペース" hint="定義は「設定」で変更できます">
          <select name="paceKey" defaultValue={defaults.paceKey ?? paces[0]?.key} className={inputClass}>
            {paces.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}（現体重の−{p.percentPerMonth}%／月{p.note ? `・${p.note}` : ''}）
              </option>
            ))}
          </select>
        </Field>
        <Field label="活動係数">
          <select name="activityFactor" defaultValue={String(defaults.activityFactor ?? activityFactors[0]?.value)} className={inputClass}>
            {activityFactors.map((a) => (
              <option key={a.value} value={a.value}>
                {a.value}（{a.label}）
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="メモ">
        <input name="note" maxLength={200} className={inputClass} placeholder="例：結婚式に向けてペースを上げる" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="保存しています">この目標で保存</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}

export function DeleteGoalButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('この目標の履歴を削除しますか？')) e.preventDefault()
      }}
    >
      <button type="submit" className={buttonClass.danger} aria-label="この目標を削除">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </form>
  )
}

