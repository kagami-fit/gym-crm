'use client'

import { useActionState, useState } from 'react'
import { ExternalLink, FileText, Image as ImageIcon, Trash2 } from 'lucide-react'
import { deleteAnsAction } from '@/app/(app)/clients/[id]/steps/actions'
import { FormMessage, SubmitButton, type ActionState } from '@/components/SubmitButton'
import { Field, buttonClass, inputClass } from '@/components/ui'
import type { AnsRow } from '@/lib/data/ans'
import { ymdJa, type Ymd } from '@/lib/dates'
import { cn } from '@/lib/utils'

const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`)

/**
 * 自律神経の測定結果（測定器が出す PDF・画面の写真）を測定日ごとに保存する。
 * 開くと別のタブで表示。トレーニングの記録の一覧にも、その日の測定結果へのリンクが出る。
 */
export function AnsPanel({ clientId, action, base, rows }: { clientId: string; action: (p: ActionState, fd: FormData) => Promise<ActionState>; base: Ymd; rows: AnsRow[] }) {
  const [state, formAction] = useActionState(action, null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const list = rows.filter((r) => !removed.has(r.id))

  async function remove(r: AnsRow) {
    if (!confirm(`${ymdJa(r.measuredOn, false)}の測定結果（${r.fileName}）を削除しますか？`)) return
    setRemoved((s) => new Set(s).add(r.id))
    const res = await deleteAnsAction(clientId, r.id)
    if (!res.ok)
      setRemoved((s) => {
        const n = new Set(s)
        n.delete(r.id)
        return n
      })
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 rounded-xl border border-line bg-soft p-4 md:grid-cols-[11rem_minmax(0,1fr)]">
        <Field label="測定日" required>
          <input type="date" name="measuredOn" defaultValue={base} required className={inputClass} />
        </Field>
        <Field label="ファイル" hint="PDF か写真（JPEG・PNG）。3.5MBまで" required>
          <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp" required className={cn(inputClass, 'py-2 file:mr-3 file:rounded-full file:border-0 file:bg-dark file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white')} />
        </Field>
        <Field label="メモ（任意）" className="md:col-span-2">
          <input name="note" maxLength={300} placeholder="例：前回より副交感神経の値が上がった" className={inputClass} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <SubmitButton pendingText="保存しています">測定結果を保存</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>

      {list.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {list.map((r) => {
            const Icon = r.mimeType === 'application/pdf' ? FileText : ImageIcon
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <Icon className="size-5 flex-none text-ink-3" aria-hidden />
                <span className="num text-[15px] font-black">{ymdJa(r.measuredOn)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                  {r.fileName}
                  <span className="num ml-1.5 text-xs text-ink-3">{size(r.size)}</span>
                </span>
                <a href={`/api/ans/${r.id}`} target="_blank" rel="noreferrer" className={buttonClass.small}>
                  <ExternalLink className="size-4" aria-hidden />
                  開く
                </a>
                <button type="button" onClick={() => void remove(r)} className={buttonClass.danger} aria-label={`${ymdJa(r.measuredOn, false)}の測定結果を削除`}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
                {r.note && <p className="w-full pl-8 text-sm text-ink-2">{r.note}</p>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ測定結果はありません</p>
      )}
    </div>
  )
}
