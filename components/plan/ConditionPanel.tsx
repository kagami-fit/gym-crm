'use client'

import { useState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { deleteConditionCheckAction, saveConditionCheckAction } from '@/app/(app)/clients/[id]/plan/actions'
import { Field, buttonClass, inputClass } from '@/components/ui'
import { CONDITION_ITEMS, CONDITION_LEVELS, type ConditionLevel } from '@/lib/condition'
import type { ConditionRow } from '@/lib/data/plan'
import { md, mdw, type Ymd } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { ConditionChip } from './Chips'

const LEVEL_KEYS = Object.keys(CONDITION_LEVELS) as ConditionLevel[]

/**
 * 体調チェック（本人の訴え）。来店ごとに、疲労・痛み・不調・食後の眠気・睡眠の悩みを「なし・少し・強い」で残す。
 * 同じ日にもう一度保存すると上書き。初回が「最初の訴え」になり、概要で最新と並べる。
 */
export function ConditionPanel({ clientId, base, rows }: { clientId: string; base: Ymd; rows: ConditionRow[] }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = rows.filter((r) => !removed.has(r.id))
  const firstId = list[0]?.id

  async function remove(r: ConditionRow) {
    if (!confirm(`${md(r.date)}の体調チェックを削除しますか？`)) return
    setRemoved((s) => new Set(s).add(r.id))
    const res = await deleteConditionCheckAction(clientId, r.id)
    if (!res.ok)
      setRemoved((s) => {
        const n = new Set(s)
        n.delete(r.id)
        return n
      })
  }

  return (
    <div className="space-y-4">
      <ConditionForm key={base} clientId={clientId} base={base} rows={list} />
      {list.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-tint text-left text-xs text-ink-2">
              <tr>
                <th className="px-3 py-2 font-bold">日付</th>
                {CONDITION_ITEMS.map((it) => (
                  <th key={it.key} className="px-2 py-2 font-bold">
                    {it.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-bold">部位・メモ</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...list].reverse().map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="num">{mdw(r.date)}</span>
                    {r.id === firstId && <span className="ml-1.5 text-xs font-bold text-ink-3">初回</span>}
                  </td>
                  {CONDITION_ITEMS.map((it) => (
                    <td key={it.key} className="px-2 py-2">
                      <ConditionChip level={r.items[it.key]} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-ink-2">{[r.painArea ? `痛み：${r.painArea}` : null, r.note].filter(Boolean).join('／')}</td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => void remove(r)} className={buttonClass.danger} aria-label={`${md(r.date)}の体調チェックを削除`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ体調チェックはありません。初回の記録が「最初の訴え」になります</p>
      )}
    </div>
  )
}

function ConditionForm({ clientId, base, rows }: { clientId: string; base: Ymd; rows: ConditionRow[] }) {
  const existing = (d: Ymd) => rows.find((r) => r.date === d)
  const fill = (d: Ymd) => {
    const r = existing(d)
    return { items: { ...(r?.items ?? {}) } as Record<string, string>, painArea: r?.painArea ?? '', note: r?.note ?? '' }
  }
  const [date, setDate] = useState(base)
  const [v, setV] = useState(fill(base))
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    setMessage(null)
    const r = await saveConditionCheckAction(clientId, { date, items: v.items, painArea: v.painArea, note: v.note })
    setPending(false)
    setMessage(r.ok ? { ok: true, text: `${md(date)}の体調チェックを保存しました` } : { ok: false, text: r.message })
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-soft p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="日付" required className="w-44">
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setV(fill(e.target.value))
            }}
            required
            className={inputClass}
          />
        </Field>
        {existing(date) && <p className="pb-3 text-sm text-ink-2">この日の記録があります（保存すると上書き）</p>}
      </div>
      <ul className="divide-y divide-line rounded-xl bg-white ring-1 ring-line">
        {CONDITION_ITEMS.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
            <span className="min-w-[8rem] flex-1">
              <span className="block font-bold">{it.label}</span>
              {it.hint && <span className="block text-xs text-ink-3">{it.hint}</span>}
            </span>
            <span className="flex gap-1.5" role="group" aria-label={it.label}>
              {LEVEL_KEYS.map((lv) => {
                const on = v.items[it.key] === lv
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setV((x) => ({ ...x, items: { ...x.items, [it.key]: on ? '' : lv } }))}
                    aria-pressed={on}
                    className={cn('h-11 min-w-16 rounded-full px-4 text-sm font-bold ring-1', on ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}
                  >
                    {CONDITION_LEVELS[lv].label}
                  </button>
                )
              })}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <Field label="痛みの部位">
          <input value={v.painArea} onChange={(e) => setV((x) => ({ ...x, painArea: e.target.value }))} maxLength={60} placeholder="例：左股関節" className={inputClass} />
        </Field>
        <Field label="メモ" hint="本人の言葉で（例：夕方に疲れが出る、食後に眠くなる）">
          <input value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} maxLength={300} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          体調チェックを保存
        </button>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={cn('rounded-lg px-3 py-2 text-sm font-bold', message.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
