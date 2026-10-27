'use client'

import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { savePhaseAction } from '@/app/(app)/clients/[id]/plan/actions'
import { Field, buttonClass, inputClass } from '@/components/ui'
import type { MovementCheckRow } from '@/lib/data/plan'
import type { Ymd } from '@/lib/dates'
import { PHASE_2 } from '@/lib/labels'
import { MOVEMENTS } from '@/lib/movements'
import { AnsGallery, type AnsFile } from './AnsGallery'
import { MovementChip } from './Chips'

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-3 first:pt-0">
      <span className="num flex size-7 items-center justify-center rounded-full bg-dark text-sm font-bold text-white">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-black">{title}</p>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  )
}

/**
 * フェーズ2への移行チェック（フェーズ1の間だけ出す）。
 * 自律神経の測定票（最新と前回）と基礎動作を同じ画面で見て、担当者が理由を書いてから進める。
 * 自動では変えない。何回の測定で確認するか・どの動作を必須にするかは未確定なので、判定はしない。
 * （痛み・不調の経過は、体調チェックをいったん画面から外したため出していない）
 */
export function Phase2Check({
  clientId,
  base,
  ans,
  movements,
  visitFrequency,
}: {
  clientId: string
  base: Ymd
  /** 新しい順 */
  ans: AnsFile[]
  movements: Record<string, MovementCheckRow | undefined>
  visitFrequency: string | null
}) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(base)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    if (!reason.trim()) return setError('進める理由を入れてください')
    setPending(true)
    setError(null)
    const r = await savePhaseAction(clientId, { name: PHASE_2, start, note: reason, visitFrequency: visitFrequency ?? undefined })
    setPending(false)
    if (!r.ok) return setError(r.message)
    setReason('')
    setOpen(false)
  }

  return (
    <div className="rounded-xl border border-line bg-soft p-4">
      <p className="text-base font-black">フェーズ2への移行チェック</p>
      <p className="mt-0.5 text-sm text-ink-2">自動では変えません。測定票と基礎動作を見て、担当者が理由を書いてから進めます。</p>
      <ol className="mt-3 divide-y divide-line">
        <Step n={1} title="自律神経：最新と前回の測定票を見比べる">
          {ans.length ? (
            <div className="max-w-xl">
              <AnsGallery files={ans} mode="compare" />
            </div>
          ) : (
            <p className="text-sm text-ink-3">まだ測定結果がありません</p>
          )}
        </Step>
        <Step n={2} title="ピラティスによる基礎動作の達成状況">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {MOVEMENTS.map((m) => (
              <li key={m.key} className="flex items-center gap-1">
                {m.label}
                <MovementChip status={movements[m.key]?.status} />
              </li>
            ))}
          </ul>
        </Step>
        <Step n={3} title="次の段階へ進めると判断した理由">
          {open ? (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <Field label="フェーズ2の開始日" required>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required className={inputClass} />
                </Field>
                <Field label="進める理由" required>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} placeholder="例：自律神経が2回続けて両方基準内。腰の痛みもなく、屈曲・伸展ができるようになった" className={inputClass} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" disabled={pending} className={buttonClass.primary}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
                  フェーズ2へ進める
                </button>
                <button type="button" onClick={() => setOpen(false)} className={buttonClass.ghost}>
                  やめる
                </button>
                {error && (
                  <p role="alert" className="w-full text-sm font-bold text-danger">
                    {error}
                  </p>
                )}
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => (setError(null), setOpen(true))} className={buttonClass.secondary}>
              理由を書いてフェーズ2へ進める
            </button>
          )}
        </Step>
      </ol>
    </div>
  )
}
