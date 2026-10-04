'use client'

import { useState } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { deleteWeightReviewAction, saveWeightReviewAction } from '@/app/(app)/clients/[id]/body/actions'
import { Badge, Field, buttonClass, inputClass } from '@/components/ui'
import type { WeightReviewRow } from '@/lib/data/plan'
import { md, type Ymd } from '@/lib/dates'
import { WEIGHT_VERDICTS, type WeightVerdict } from '@/lib/labels'
import { cn } from '@/lib/utils'

const VERDICTS = Object.keys(WEIGHT_VERDICTS) as WeightVerdict[]

/** 体重の変化への担当者の評価（想定内／見直しが必要／評価保留）と理由を、日付つきで残す */
export function WeightReviewPanel({ clientId, base, rows }: { clientId: string; base: Ymd; rows: WeightReviewRow[] }) {
  const [date, setDate] = useState(base)
  const [verdict, setVerdict] = useState<WeightVerdict | ''>('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = rows.filter((r) => !removed.has(r.id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    if (!verdict) return setError('評価を選んでください')
    setPending(true)
    setError(null)
    const r = await saveWeightReviewAction(clientId, { date, verdict, reason })
    setPending(false)
    if (!r.ok) return setError(r.message)
    setVerdict('')
    setReason('')
  }

  async function remove(r: WeightReviewRow) {
    if (!confirm(`${md(r.date)}の評価を削除しますか？`)) return
    setRemoved((s) => new Set(s).add(r.id))
    await deleteWeightReviewAction(clientId, r.id)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-soft p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="日付" required className="w-44">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
          </Field>
          <div>
            <span className="text-sm font-bold">評価</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="評価">
              {VERDICTS.map((k) => (
                <button key={k} type="button" onClick={() => setVerdict(k)} aria-pressed={verdict === k} className={cn('h-11 rounded-full px-4 text-sm font-bold ring-1', verdict === k ? 'bg-dark text-white ring-dark' : 'bg-white text-ink-2 ring-line-2 hover:bg-soft')}>
                  {WEIGHT_VERDICTS[k].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Field label="理由">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="例：週0.5%前後で減っている。食事の記録も安定" className={inputClass} />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={pending} className={buttonClass.primary}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            評価を保存
          </button>
          {error && (
            <p role="alert" className="text-sm font-bold text-danger">
              {error}
            </p>
          )}
        </div>
      </form>
      {list.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="num w-14 flex-none text-sm font-semibold text-ink-2">{md(r.date)}</span>
              <Badge tone={WEIGHT_VERDICTS[r.verdict].tone}>{WEIGHT_VERDICTS[r.verdict].label}</Badge>
              <span className="min-w-0 flex-1 text-sm text-ink-2">{r.reason ?? ''}</span>
              <button type="button" onClick={() => void remove(r)} className={buttonClass.danger} aria-label={`${md(r.date)}の評価を削除`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
