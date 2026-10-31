'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { deleteAnsAction } from '@/app/(app)/clients/[id]/plan/actions'
import { AnsGallery, type AnsFile } from '@/components/plan/AnsGallery'
import { FormMessage, type ActionState } from '@/components/SubmitButton'
import { Field, buttonClass, inputClass } from '@/components/ui'
import { ymdJa, type Ymd } from '@/lib/dates'
import { shrinkImage } from '@/lib/image'
import { cn } from '@/lib/utils'

/**
 * 自律神経の測定（condiView の測定票の PDF・写真）を測定日ごとに保存して、すぐ見られるように並べる。
 * 押すと全画面で大きく開き、「前回と並べる」でお客様に見せながら比べられる。
 * 数値・グレーゾーンとの位置の記録は、いったん画面から外している（データの欄は残している。2026-10 はやとさんの判断）。
 */
export function AnsPanel({ clientId, action, base, rows }: { clientId: string; action: (p: ActionState, fd: FormData) => Promise<ActionState>; base: Ymd; rows: AnsFile[] }) {
  const [state, formAction, pending] = useActionState(action, null)
  const [formOpen, setFormOpen] = useState(rows.length === 0)
  const [preparing, setPreparing] = useState(false)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const formRef = useRef<HTMLFormElement>(null)
  const list = rows.filter((r) => !removed.has(r.id))

  // 保存できたら入力を空に戻す
  useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending || preparing) return
    const fd = new FormData(e.currentTarget)
    const f = fd.get('file')
    if (f instanceof File && f.size > 0) {
      setPreparing(true)
      fd.set('file', await shrinkImage(f))
      setPreparing(false)
    }
    startTransition(() => formAction(fd))
  }

  async function remove(r: AnsFile) {
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

  const busy = pending || preparing
  return (
    <div className="space-y-4">
      {formOpen ? (
        <form ref={formRef} onSubmit={(e) => void submit(e)} className="space-y-3 rounded-xl border border-line bg-soft p-4">
          <p className="text-sm font-black">測定結果を入れる</p>
          <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)]">
            <Field label="測定日" required>
              <input type="date" name="measuredOn" defaultValue={base} required className={inputClass} />
            </Field>
            <Field label="測定票" hint="PDF か写真。iPad ならその場で撮影もできます（大きい写真は自動で小さくします）" required>
              <input type="file" name="file" accept="application/pdf,image/*" required className={cn(inputClass, 'py-2 file:mr-3 file:rounded-full file:border-0 file:bg-dark file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white')} />
            </Field>
          </div>
          <Field label="メモ（任意）">
            <input name="note" maxLength={300} placeholder="例：前回より疲れが少ないと話していた" className={inputClass} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className={buttonClass.primary}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {busy ? '保存しています' : '測定結果を保存'}
            </button>
            {list.length > 0 && (
              <button type="button" onClick={() => setFormOpen(false)} className={buttonClass.ghost}>
                閉じる
              </button>
            )}
            <FormMessage state={state} />
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setFormOpen(true)} className={buttonClass.secondary}>
            <Plus className="size-4" aria-hidden />
            測定結果を追加
          </button>
          <FormMessage state={state} />
        </div>
      )}

      {list.length ? (
        <AnsGallery
          files={list}
          footer={(f) => (
            <div className="flex justify-end">
              <button type="button" onClick={() => void remove(f)} className={cn(buttonClass.danger, 'h-9 min-w-9 text-xs')} aria-label={`${ymdJa(f.measuredOn, false)}の測定結果を削除`}>
                <Trash2 className="size-4" aria-hidden />
                削除
              </button>
            </div>
          )}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-line-2 bg-white/60 px-4 py-5 text-center text-sm text-ink-2">まだ測定結果はありません</p>
      )}
    </div>
  )
}
